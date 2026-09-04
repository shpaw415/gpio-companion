package expo.modules.openauthster

import android.net.Uri
import com.openauthster.OpenAuthsterClient
import com.openauthster.OpenAuthsterConfig
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class OpenAuthsterModule : Module() {
	private var client: OpenAuthsterClient? = null

	override fun definition() = ModuleDefinition {
		Name("OpenAuthster")

		AsyncFunction("configure") { issuer: String, clientId: String, redirectUri: String ->
			val context = appContext.reactContext ?: throw IllegalStateException("no android context")
			client =
				OpenAuthsterClient(
					context,
					OpenAuthsterConfig(
						issuer = Uri.parse(issuer),
						clientId = clientId,
						redirectUri = Uri.parse(redirectUri),
					),
				)
		}

		AsyncFunction("login") { provider: String ->
			val current = client ?: throw IllegalStateException("call configure first")
			val context = appContext.currentActivity ?: throw IllegalStateException("no activity")
			current.launchLogin(context, provider)
			""
		}

		AsyncFunction("handleCallback") { url: String ->
			val current = client ?: throw IllegalStateException("call configure first")
			current.handleCallback(Uri.parse(url))
			current.accessToken() ?: throw IllegalStateException("missing access token")
		}

		AsyncFunction("logout") {
			client?.logout()
		}

		AsyncFunction("getAccessToken") {
			client?.getValidAccessToken()
		}

		AsyncFunction("isAuthenticated") {
			client?.isAuthenticated == true
		}
	}
}
