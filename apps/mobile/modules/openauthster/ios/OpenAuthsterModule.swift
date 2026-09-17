import AuthenticationServices
import ExpoModulesCore
import UIKit

public class OpenAuthsterModule: Module {
	private var client: OpenAuthsterClient?
	private var issuer: URL?
	private var clientID: String?
	private var redirectURI: URL?

	public func definition() -> ModuleDefinition {
		Name("OpenAuthster")

		AsyncFunction("configure") { (issuer: String, clientId: String, redirectUri: String) in
			guard let issuerURL = URL(string: issuer),
			      let redirectURL = URL(string: redirectUri)
			else {
				throw Exception(name: "OpenAuthster", description: "invalid auth URLs")
			}
			self.applyConfig(issuer: issuerURL, clientID: clientId, redirectURI: redirectURL)
		}

		AsyncFunction("login") { (provider: String) -> String in
			let client = try self.requireClient()
			let anchor = Self.keyWindow() ?? ASPresentationAnchor()
			try await client.login(provider: provider, anchor: anchor)
			guard let token = try client.accessToken() else {
				throw Exception(name: "OpenAuthster", description: "missing access token")
			}
			return token
		}.runOnQueue(.main)

		AsyncFunction("logout") {
			try self.client?.logout()
		}

		AsyncFunction("getAccessToken") { () -> String? in
			guard let client = self.requireClientOrNil() else {
				return nil
			}
			return try await client.getValidAccessToken()
		}.runOnQueue(.main)

		AsyncFunction("isAuthenticated") { () -> Bool in
			self.requireClientOrNil()?.isAuthenticated ?? false
		}

		AsyncFunction("handleCallback") { (url: String) -> String in
			throw Exception(name: "OpenAuthster", description: "iOS login handles the callback")
		}
	}

	private func applyConfig(issuer: URL, clientID: String, redirectURI: URL) {
		self.issuer = issuer
		self.clientID = clientID
		self.redirectURI = redirectURI
		self.client = OpenAuthsterClient(
			config: OpenAuthsterConfig(
				issuer: issuer,
				clientID: clientID,
				redirectURI: redirectURI
			)
		)
	}

	private func requireClient() throws -> OpenAuthsterClient {
		guard let client = requireClientOrNil() else {
			throw Exception(name: "OpenAuthster", description: "call configure first")
		}
		return client
	}

	private func requireClientOrNil() -> OpenAuthsterClient? {
		if let client {
			return client
		}
		guard let issuer, let clientID, let redirectURI else {
			return nil
		}
		applyConfig(issuer: issuer, clientID: clientID, redirectURI: redirectURI)
		return client
	}

	private static func keyWindow() -> UIWindow? {
		UIApplication.shared.connectedScenes
			.compactMap { $0 as? UIWindowScene }
			.flatMap { $0.windows }
			.first { $0.isKeyWindow }
	}
}
