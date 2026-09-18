package expo.modules.openauthster

import android.content.Context
import android.net.Uri
import com.openauthster.OpenAuthsterClient
import com.openauthster.OpenAuthsterConfig
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class OpenAuthsterModule : Module() {
	private var client: OpenAuthsterClient? = null
	private var issuer: String? = null
	private var clientId: String? = null
	private var redirectUri: String? = null

	override fun definition() = ModuleDefinition {
		Name("OpenAuthster")

		AsyncFunction("configure") { issuer: String, clientId: String, redirectUri: String ->
			applyConfig(issuer, clientId, redirectUri)
		}

		AsyncFunction("login") { provider: String ->
			val current = requireClient()
			val context = appContext.currentActivity ?: throw IllegalStateException("no activity")
			current.launchLogin(context, provider)
			""
		}

		AsyncFunction("handleCallback") { url: String ->
			val current = requireClient()
			current.handleCallback(Uri.parse(url))
			current.accessToken() ?: throw IllegalStateException("missing access token")
		}

		AsyncFunction("logout") {
			client?.logout()
		}

		AsyncFunction("getAccessToken") {
			requireClientOrNull()?.getValidAccessToken()
		}

		AsyncFunction("isAuthenticated") {
			requireClientOrNull()?.isAuthenticated == true
		}
	}

	private fun androidContext(): Context {
		return appContext.reactContext?.applicationContext
			?: appContext.currentActivity?.applicationContext
			?: appContext.currentActivity
			?: throw IllegalStateException("no android context")
	}

	@Synchronized
	private fun applyConfig(issuer: String, clientId: String, redirectUri: String) {
		if (
			client != null &&
			this.issuer == issuer &&
			this.clientId == clientId &&
			this.redirectUri == redirectUri
		) {
			return
		}
		this.issuer = issuer
		this.clientId = clientId
		this.redirectUri = redirectUri
		client =
			OpenAuthsterClient(
				androidContext(),
				OpenAuthsterConfig(
					issuer = Uri.parse(issuer),
					clientId = clientId,
					redirectUri = Uri.parse(redirectUri),
				),
			)
	}

	private fun requireClient(): OpenAuthsterClient {
		return requireClientOrNull() ?: throw IllegalStateException("call configure first")
	}

	private fun requireClientOrNull(): OpenAuthsterClient? {
		client?.let { return it }
		val savedIssuer = issuer ?: return null
		val savedClientId = clientId ?: return null
		val savedRedirect = redirectUri ?: return null
		applyConfig(savedIssuer, savedClientId, savedRedirect)
		return client
	}
}
