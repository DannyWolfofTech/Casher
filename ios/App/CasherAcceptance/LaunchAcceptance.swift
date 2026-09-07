import XCTest

final class LaunchAcceptance: XCTestCase {
    override func setUpWithError() throws { continueAfterFailure = false }

    private func capture(_ name: String) {
        let image = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        image.name = name
        image.lifetime = .keepAlways
        add(image)
    }

    func testSignedOutNavigationAndRelaunch() throws {
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.webViews.staticTexts["Welcome back"].waitForExistence(timeout: 30))
        XCTAssertFalse(app.webViews.buttons["Continue with Google"].exists)
        XCTAssertFalse(app.staticTexts["Device services could not start. Close and reopen Casher."].exists)
        XCTAssertFalse(app.staticTexts["We could not check this link. Please reload and try again."].exists)
        capture("ios-auth-portrait")

        app.webViews.buttons["Forgot password?"].tap()
        XCTAssertTrue(app.webViews.staticTexts["Reset your password"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.webViews.buttons["Send reset link"].exists)
        app.webViews.buttons["Back to sign in"].tap()
        app.webViews.buttons["Create an account"].tap()
        XCTAssertTrue(app.webViews.staticTexts["Create your account"].waitForExistence(timeout: 10))
        capture("ios-signup")
        app.terminate()
        app.launch()
        XCTAssertTrue(app.webViews.staticTexts["Welcome back"].waitForExistence(timeout: 30))
        XCUIDevice.shared.orientation = .landscapeLeft
        XCTAssertTrue(app.webViews.buttons["Sign in"].waitForExistence(timeout: 10))
        capture("ios-auth-landscape")
        XCUIDevice.shared.orientation = .portrait
    }

    func testPrivacyIsAvailableInsideTheNativeApp() throws {
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.webViews.links["Privacy Policy"].waitForExistence(timeout: 30))
        app.webViews.links["Privacy Policy"].tap()
        XCTAssertTrue(app.webViews.staticTexts["Privacy Policy"].waitForExistence(timeout: 15))
        XCTAssertTrue(app.webViews.staticTexts["Bank connections and payments"].exists)
        capture("ios-privacy")
    }
}
