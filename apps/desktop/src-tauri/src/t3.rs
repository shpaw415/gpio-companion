use std::sync::Mutex;
use tauri::{AppHandle, Manager, State, WindowEvent};
#[cfg(not(target_os = "linux"))]
use tauri::{LogicalPosition, LogicalSize, Rect, WebviewBuilder, WebviewUrl};

#[cfg(not(target_os = "linux"))]
const LABEL: &str = "t3";
const MAIN: &str = "main";

#[derive(Default)]
pub struct T3Pane {
	visible: bool,
	chrome_h: f64,
	url: String,
}

#[cfg(target_os = "linux")]
mod linux {
	use gtk::prelude::*;
	use std::cell::{Cell, RefCell};
	use webkit2gtk::WebViewExt;

	struct Host {
		fixed: gtk::Fixed,
		main: gtk::Widget,
		t3: Option<webkit2gtk::WebView>,
		chrome_px: i32,
		visible: bool,
		url: String,
	}

	thread_local! {
		static HOST: RefCell<Option<Host>> = const { RefCell::new(None) };
		static BUSY: Cell<bool> = const { Cell::new(false) };
	}

	fn clamp_widget(widget: &impl IsA<gtk::Widget>) {
		widget.set_hexpand(false);
		widget.set_vexpand(false);
		widget.set_size_request(1, 1);
	}

	pub fn install(window: &tauri::Window) -> Result<(), String> {
		let vbox = window.default_vbox().map_err(|e| e.to_string())?;
		let main = vbox
			.children()
			.into_iter()
			.find(|child| child.downcast_ref::<webkit2gtk::WebView>().is_some())
			.ok_or("main webkit widget missing")?;
		vbox.remove(&main);
		clamp_widget(&main);
		let fixed = gtk::Fixed::new();
		fixed.set_hexpand(true);
		fixed.set_vexpand(true);
		fixed.put(&main, 0, 0);
		vbox.pack_start(&fixed, true, true, 0);
		fixed.show_all();
		HOST.with(|slot| {
			*slot.borrow_mut() = Some(Host {
				fixed: fixed.clone(),
				main,
				t3: None,
				chrome_px: 48,
				visible: false,
				url: String::new(),
			});
		});
		fixed.connect_size_allocate(|_, _| {
			relayout();
		});
		Ok(())
	}

	fn place(fixed: &gtk::Fixed, widget: &impl IsA<gtk::Widget>, x: i32, y: i32, w: i32, h: i32) {
		fixed.move_(widget, x, y);
		widget.size_allocate(&gtk::Allocation::new(x, y, w.max(1), h.max(1)));
	}

	fn layout(host: &Host) {
		if BUSY.get() {
			return;
		}
		BUSY.set(true);
		struct Reset;
		impl Drop for Reset {
			fn drop(&mut self) {
				BUSY.set(false);
			}
		}
		let _reset = Reset;
		let alloc = host.fixed.allocation();
		let width = alloc.width();
		let height = alloc.height();
		if width <= 1 || height <= 1 {
			return;
		}
		place(&host.fixed, &host.main, 0, 0, width, height);
		let Some(t3) = &host.t3 else {
			return;
		};
		if !host.visible {
			t3.hide();
			return;
		}
		let top = host.chrome_px.clamp(48, (height - 80).max(48));
		place(&host.fixed, t3, 0, top, width, (height - top).max(80));
		t3.show();
	}

	pub fn show(url: &str, chrome_h: f64, scale: f64) -> Result<(), String> {
		HOST.with(|slot| {
			let mut slot = slot.borrow_mut();
			let host = slot
				.as_mut()
				.ok_or_else(|| "t3 gtk host missing".to_string())?;
			host.visible = true;
			host.chrome_px = (chrome_h * scale).round() as i32;
			if host.t3.is_none() {
				let t3 = webkit2gtk::WebView::new();
				clamp_widget(&t3);
				t3.load_uri(url);
				host.fixed.put(&t3, 0, 0);
				host.url = url.to_string();
				host.t3 = Some(t3);
			} else if host.url != url {
				if let Some(t3) = &host.t3 {
					t3.load_uri(url);
				}
				host.url = url.to_string();
			}
			layout(host);
			Ok(())
		})
	}

	pub fn hide() {
		HOST.with(|slot| {
			if let Some(host) = slot.borrow_mut().as_mut() {
				host.visible = false;
				layout(host);
			}
		});
	}

	pub fn relayout() {
		HOST.with(|slot| {
			if let Some(host) = slot.borrow().as_ref() {
				layout(host);
			}
		});
	}

}

fn physical_inner(app: &AppHandle) -> Result<(u32, u32, f64), String> {
	let window = app.get_window(MAIN).ok_or("main window missing")?;
	let factor = window.scale_factor().map_err(|e| e.to_string())?;
	let size = window.inner_size().map_err(|e| e.to_string())?;
	Ok((size.width, size.height, factor))
}

#[cfg(not(target_os = "linux"))]
fn rect(x: f64, y: f64, w: f64, h: f64) -> Rect {
	Rect {
		position: LogicalPosition::new(x, y).into(),
		size: LogicalSize::new(w.max(1.0), h.max(1.0)).into(),
	}
}

#[cfg(not(target_os = "linux"))]
fn overlay_t3(app: &AppHandle, chrome_h: f64) -> Result<(), String> {
	let window = app.get_window(MAIN).ok_or("main window missing")?;
	let factor = window.scale_factor().map_err(|e| e.to_string())?;
	let size = window.inner_size().map_err(|e| e.to_string())?;
	let logical = size.to_logical::<f64>(factor);
	let top = chrome_h.clamp(48.0, (logical.height - 80.0).max(48.0));
	if let Some(t3) = app.get_webview(LABEL) {
		t3.set_bounds(rect(
			0.0,
			top,
			logical.width,
			(logical.height - top).max(80.0),
		))
		.map_err(|e| e.to_string())?;
		let _ = t3.set_auto_resize(false);
		t3.show().map_err(|e| e.to_string())?;
	}
	Ok(())
}

#[cfg(target_os = "linux")]
fn run_gtk<T: Send + 'static>(
	app: &AppHandle,
	f: impl FnOnce() -> T + Send + 'static,
) -> Result<T, String> {
	let window = app.get_window(MAIN).ok_or("main window missing")?;
	let (tx, rx) = std::sync::mpsc::channel();
	window
		.run_on_main_thread(move || {
			let _ = tx.send(f());
		})
		.map_err(|e| e.to_string())?;
	rx.recv().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn t3_pane_show(
	app: AppHandle,
	url: String,
	chrome_h: f64,
	state: State<'_, Mutex<T3Pane>>,
) -> Result<(), String> {
	let _parsed = url::Url::parse(&url).map_err(|e| e.to_string())?;
	#[cfg(not(target_os = "linux"))]
	let parsed = _parsed;
	#[cfg(target_os = "linux")]
	let _ = _parsed;
	{
		let mut pane = state.lock().map_err(|e| e.to_string())?;
		pane.visible = true;
		pane.chrome_h = chrome_h;
		pane.url = url.clone();
	}
	#[cfg(target_os = "linux")]
	{
		let (_, _, scale) = physical_inner(&app)?;
		return run_gtk(&app, move || linux::show(&url, chrome_h, scale))?;
	}
	#[cfg(not(target_os = "linux"))]
	{
		if let Some(t3) = app.get_webview(LABEL) {
			let current = t3.url().ok();
			if current.as_ref() != Some(&parsed) {
				t3.navigate(parsed).map_err(|e| e.to_string())?;
			}
			overlay_t3(&app, chrome_h)?;
			return Ok(());
		}
		let window = app.get_window(MAIN).ok_or("main window missing")?;
		let factor = window.scale_factor().map_err(|e| e.to_string())?;
		let size = window.inner_size().map_err(|e| e.to_string())?;
		let logical = size.to_logical::<f64>(factor);
		let top = chrome_h.clamp(48.0, (logical.height - 80.0).max(48.0));
		window
			.add_child(
				WebviewBuilder::new(LABEL, WebviewUrl::External(parsed)),
				LogicalPosition::new(0.0, top),
				LogicalSize::new(logical.width, (logical.height - top).max(80.0)),
			)
			.map_err(|e| e.to_string())?;
		overlay_t3(&app, chrome_h)
	}
}

#[tauri::command]
pub async fn t3_pane_hide(app: AppHandle, state: State<'_, Mutex<T3Pane>>) -> Result<(), String> {
	if let Ok(mut pane) = state.lock() {
		pane.visible = false;
	}
	#[cfg(target_os = "linux")]
	{
		run_gtk(&app, linux::hide)?;
		return Ok(());
	}
	#[cfg(not(target_os = "linux"))]
	{
		if let Some(t3) = app.get_webview(LABEL) {
			t3.hide().map_err(|e| e.to_string())?;
		}
		Ok(())
	}
}

pub fn attach_resize(app: &AppHandle) {
	#[cfg(target_os = "linux")]
	if let Some(window) = app.get_window(MAIN) {
		if let Err(err) = linux::install(&window) {
			crate::log::line(&format!("t3 gtk fixed: {err}"));
		}
	}
	let Some(window) = app.get_window(MAIN) else {
		return;
	};
	#[cfg_attr(target_os = "linux", allow(unused_variables))]
	let handle = app.clone();
	let _ = window.on_window_event(move |event| {
		let WindowEvent::Resized(size) = event else {
			return;
		};
		#[cfg(target_os = "linux")]
		{
			let _ = size;
			linux::relayout();
			return;
		}
		#[cfg(not(target_os = "linux"))]
		{
			let handle = handle.clone();
			let _ = size;
			tauri::async_runtime::spawn(async move {
				let chrome_h = {
					let pane = handle.state::<Mutex<T3Pane>>();
					let Ok(pane) = pane.lock() else {
						return;
					};
					if !pane.visible {
						return;
					}
					pane.chrome_h
				};
				let _ = overlay_t3(&handle, chrome_h);
			});
		}
	});
}
