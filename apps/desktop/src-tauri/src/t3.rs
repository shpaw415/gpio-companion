use std::sync::Mutex;
use tauri::{
	AppHandle, LogicalPosition, LogicalSize, Manager, Rect, State, WebviewBuilder, WebviewUrl,
	WindowEvent,
};

const LABEL: &str = "t3";
const MAIN: &str = "main";

#[derive(Default)]
pub struct T3Pane {
	visible: bool,
	chrome_h: f64,
	url: String,
}

fn logical_inner(app: &AppHandle) -> Result<(f64, f64), String> {
	let window = app.get_window(MAIN).ok_or("main window missing")?;
	let factor = window.scale_factor().map_err(|e| e.to_string())?;
	let size = window.inner_size().map_err(|e| e.to_string())?;
	let logical = size.to_logical::<f64>(factor);
	Ok((logical.width, logical.height))
}

fn rect(x: f64, y: f64, w: f64, h: f64) -> Rect {
	Rect {
		position: LogicalPosition::new(x, y).into(),
		size: LogicalSize::new(w.max(1.0), h.max(1.0)).into(),
	}
}

fn pane_geom(height: f64, chrome_h: f64) -> (f64, f64) {
	let top = chrome_h.clamp(48.0, (height - 80.0).max(48.0));
	(top, (height - top).max(80.0))
}

fn layout(app: &AppHandle, chrome_h: f64) -> Result<(), String> {
	let (width, height) = logical_inner(app)?;
	let (top, pane_h) = pane_geom(height, chrome_h);
	if let Some(main) = app.get_webview(MAIN) {
		main.set_bounds(rect(0.0, 0.0, width, top))
			.map_err(|e| e.to_string())?;
	}
	if let Some(t3) = app.get_webview(LABEL) {
		t3.set_bounds(rect(0.0, top, width, pane_h))
			.map_err(|e| e.to_string())?;
		let _ = t3.set_auto_resize(false);
		t3.show().map_err(|e| e.to_string())?;
	}
	Ok(())
}

fn restore_main(app: &AppHandle) -> Result<(), String> {
	let (width, height) = logical_inner(app)?;
	if let Some(t3) = app.get_webview(LABEL) {
		t3.hide().map_err(|e| e.to_string())?;
	}
	if let Some(main) = app.get_webview(MAIN) {
		main.set_bounds(rect(0.0, 0.0, width, height))
			.map_err(|e| e.to_string())?;
	}
	Ok(())
}

#[tauri::command]
pub async fn t3_pane_show(
	app: AppHandle,
	url: String,
	chrome_h: f64,
	state: State<'_, Mutex<T3Pane>>,
) -> Result<(), String> {
	let parsed = url::Url::parse(&url).map_err(|e| e.to_string())?;
	let previous = {
		let mut pane = state.lock().map_err(|e| e.to_string())?;
		let previous = pane.url.clone();
		pane.visible = true;
		pane.chrome_h = chrome_h;
		pane.url = url;
		previous
	};
	if let Some(t3) = app.get_webview(LABEL) {
		if previous != parsed.as_str() {
			t3.navigate(parsed).map_err(|e| e.to_string())?;
		}
		layout(&app, chrome_h)?;
		return Ok(());
	}
	let (width, height) = logical_inner(&app)?;
	let (top, pane_h) = pane_geom(height, chrome_h);
	if let Some(main) = app.get_webview(MAIN) {
		main.set_bounds(rect(0.0, 0.0, width, top))
			.map_err(|e| e.to_string())?;
	}
	let window = app.get_window(MAIN).ok_or("main window missing")?;
	window
		.add_child(
			WebviewBuilder::new(LABEL, WebviewUrl::External(parsed)),
			LogicalPosition::new(0.0, top),
			LogicalSize::new(width, pane_h),
		)
		.map_err(|e| e.to_string())?;
	if let Some(t3) = app.get_webview(LABEL) {
		t3.set_bounds(rect(0.0, top, width, pane_h))
			.map_err(|e| e.to_string())?;
		let _ = t3.set_auto_resize(false);
		t3.show().map_err(|e| e.to_string())?;
	}
	Ok(())
}

#[tauri::command]
pub async fn t3_pane_hide(app: AppHandle, state: State<'_, Mutex<T3Pane>>) -> Result<(), String> {
	if let Ok(mut pane) = state.lock() {
		pane.visible = false;
	}
	restore_main(&app)
}

pub fn attach_resize(app: &AppHandle) {
	let Some(window) = app.get_window(MAIN) else {
		return;
	};
	let handle = app.clone();
	let _ = window.on_window_event(move |event| {
		if !matches!(event, WindowEvent::Resized(_)) {
			return;
		}
		let handle = handle.clone();
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
			let _ = layout(&handle, chrome_h);
		});
	});
}
