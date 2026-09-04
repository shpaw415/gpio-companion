import AuthenticationServices
import ExpoModulesCore
import UIKit

public class OpenAuthsterModule: Module {
	private var client: OpenAuthsterClient?

	public func definition() -> ModuleDefinition {
		Name("OpenAuthster")

		AsyncFunction("configure") { (issuer: String, clientId: String, redirectUri: String) in
			guard let issuerURL = URL(string: issuer),
			      let redirectURL = URL(string: redirectUri)
			else {
				throw Exception(name: "OpenAuthster", description: "invalid auth URLs")
			}
			self.client = OpenAuthsterClient(
				config: OpenAuthsterConfig(
					issuer: issuerURL,
					clientID: clientId,
					redirectURI: redirectURL
				)
			)
		}

		AsyncFunction("login") { (provider: String) -> String in
			guard let client = self.client else {
				throw Exception(name: "OpenAuthster", description: "call configure first")
			}
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
			guard let client = self.client else {
				return nil
			}
			return try await client.getValidAccessToken()
		}.runOnQueue(.main)

		AsyncFunction("isAuthenticated") { () -> Bool in
			self.client?.isAuthenticated ?? false
		}

		AsyncFunction("handleCallback") { (url: String) -> String in
			throw Exception(name: "OpenAuthster", description: "iOS login handles the callback")
		}
	}

	private static func keyWindow() -> UIWindow? {
		UIApplication.shared.connectedScenes
			.compactMap { $0 as? UIWindowScene }
			.flatMap { $0.windows }
			.first { $0.isKeyWindow }
	}
}
