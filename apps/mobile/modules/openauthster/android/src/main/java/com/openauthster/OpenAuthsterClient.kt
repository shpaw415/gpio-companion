package com.openauthster

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.util.Base64
import androidx.browser.customtabs.CustomTabsIntent
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import org.json.JSONObject
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.concurrent.TimeUnit

data class OpenAuthsterConfig(
	val issuer: Uri,
	val clientId: String,
	val redirectUri: Uri,
)

class OpenAuthsterClient(
	context: Context,
	private val config: OpenAuthsterConfig,
) {
	private val prefs =
		EncryptedSharedPreferences.create(
			context,
			"openauthster.${config.clientId}",
			MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),
			EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
			EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
		)

	private val refreshLock = Any()

	val isAuthenticated: Boolean
		get() = !prefs.getString(KEY_ACCESS, null).isNullOrEmpty()

	fun accessToken(): String? = prefs.getString(KEY_ACCESS, null)

	fun loginIntent(provider: String? = null): Pair<Intent, String> {
		val verifier = randomUrlSafe(32)
		val challenge = sha256Base64Url(verifier)
		val state = randomUrlSafe(16)
		val authorize =
			config.issuer
				.buildUpon()
				.appendPath("authorize")
				.appendQueryParameter("client_id", config.clientId)
				.appendQueryParameter("redirect_uri", config.redirectUri.toString())
				.appendQueryParameter("response_type", "code")
				.appendQueryParameter("code_challenge", challenge)
				.appendQueryParameter("code_challenge_method", "S256")
				.appendQueryParameter("state", state)
				.apply { if (provider != null) appendQueryParameter("provider", provider) }
				.build()
		prefs.edit().putString(KEY_VERIFIER, verifier).putString(KEY_STATE, state).apply()
		return CustomTabsIntent.Builder().build().intent.apply { data = authorize } to verifier
	}

	fun launchLogin(context: Context, provider: String? = null) {
		val (intent, _) = loginIntent(provider)
		CustomTabsIntent.Builder().build().launchUrl(context, intent.data!!)
	}

	fun handleCallback(uri: Uri) {
		val code = uri.getQueryParameter("code") ?: throw IllegalArgumentException("missing code")
		val verifier = prefs.getString(KEY_VERIFIER, null) ?: throw IllegalStateException("missing verifier")
		val expected = prefs.getString(KEY_STATE, null)
		if (!expected.isNullOrEmpty()) {
			val received = uri.getQueryParameter("state")
			if (received != expected) {
				prefs.edit().remove(KEY_STATE).remove(KEY_VERIFIER).apply()
				throw IllegalArgumentException("auth state mismatch")
			}
		}
		prefs.edit().remove(KEY_STATE).remove(KEY_VERIFIER).apply()
		val payload =
			exchangeTokens(
				"grant_type" to "authorization_code",
				"client_id" to config.clientId,
				"code" to code,
				"redirect_uri" to config.redirectUri.toString(),
				"code_verifier" to verifier,
			)
		storeTokens(payload, fallbackRefresh = null)
	}

	/**
	 * Returns a usable access token, refreshing it first when it is about to
	 * expire. Returns null only when the stored session is unrecoverable.
	 */
	fun getValidAccessToken(): String? {
		val access = prefs.getString(KEY_ACCESS, null) ?: return null
		val expiresAt = prefs.getLong(KEY_EXPIRES, 0L)
		val needsRefresh = expiresAt > 0L && System.currentTimeMillis() > expiresAt - REFRESH_MARGIN_MS
		if (!needsRefresh) {
			return access
		}
		val refresh = prefs.getString(KEY_REFRESH, null)
		if (refresh.isNullOrEmpty()) {
			logout()
			return null
		}
		synchronized(refreshLock) {
			// another caller may have refreshed while this one waited on the lock
			val current = prefs.getString(KEY_ACCESS, null)
			val currentExpiry = prefs.getLong(KEY_EXPIRES, 0L)
			val alreadyFresh = current != null &&
				(currentExpiry <= 0L || System.currentTimeMillis() < currentExpiry - REFRESH_MARGIN_MS)
			if (alreadyFresh) {
				return current
			}
			return try {
				val payload =
					exchangeTokens(
						"grant_type" to "refresh_token",
						"client_id" to config.clientId,
						"refresh_token" to refresh,
					)
				storeTokens(payload, fallbackRefresh = refresh)
				payload.getString("access_token")
			} catch (error: IllegalStateException) {
				// the auth server rejected the refresh: sign out cleanly
				logout()
				null
			} catch (error: Exception) {
				// transient network failure: keep the stored tokens for the next attempt
				access
			}
		}
	}

	fun logout() {
		prefs.edit().clear().apply()
	}

	private fun exchangeTokens(vararg form: Pair<String, String>): JSONObject {
		val body = form.joinToString("&") { "${it.first}=${Uri.encode(it.second)}" }
		val connection =
			java.net.URL(config.issuer.buildUpon().appendPath("token").build().toString())
				.openConnection() as java.net.HttpURLConnection
		connection.requestMethod = "POST"
		connection.setRequestProperty("Content-Type", "application/x-www-form-urlencoded")
		connection.connectTimeout = CONNECTION_TIMEOUT_MS
		connection.readTimeout = READ_TIMEOUT_MS
		connection.doOutput = true
		try {
			connection.outputStream.use { it.write(body.toByteArray()) }
			val status = connection.responseCode
			val stream = if (status in 200..299) connection.inputStream else connection.errorStream
			val payload = stream?.bufferedReader()?.use { it.readText() } ?: ""
			if (status !in 200..299) {
				throw IllegalStateException("auth server error (HTTP $status)")
			}
			return JSONObject(payload)
		} finally {
			connection.disconnect()
		}
	}

	private fun storeTokens(payload: JSONObject, fallbackRefresh: String?) {
		prefs
			.edit()
			.putString(KEY_ACCESS, payload.getString("access_token"))
			.putString(KEY_REFRESH, payload.optString("refresh_token", fallbackRefresh))
			.putLong(
				KEY_EXPIRES,
				System.currentTimeMillis() + TimeUnit.SECONDS.toMillis(payload.optLong("expires_in", 3600)),
			).apply()
	}

	companion object {
		private const val KEY_ACCESS = "access"
		private const val KEY_REFRESH = "refresh"
		private const val KEY_EXPIRES = "expires"
		private const val KEY_VERIFIER = "verifier"
		private const val KEY_STATE = "state"
		private const val CONNECTION_TIMEOUT_MS = 10_000
		private const val READ_TIMEOUT_MS = 10_000
		private const val REFRESH_MARGIN_MS = 30_000L

		private fun randomUrlSafe(bytes: Int): String {
			val buffer = ByteArray(bytes)
			SecureRandom().nextBytes(buffer)
			return Base64.encodeToString(buffer, Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING)
		}

		private fun sha256Base64Url(value: String): String {
			val digest = MessageDigest.getInstance("SHA-256").digest(value.toByteArray())
			return Base64.encodeToString(digest, Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING)
		}
	}
}
