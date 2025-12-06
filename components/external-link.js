"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExternalLink = void 0;
const expo_router_1 = require("expo-router");
const expo_web_browser_1 = require("expo-web-browser");
function ExternalLink({ href, ...rest }) {
    return (<expo_router_1.Link target="_blank" {...rest} href={href} onPress={async (event) => {
            if (process.env.EXPO_OS !== 'web') {
                // Prevent the default behavior of linking to the default browser on native.
                event.preventDefault();
                // Open the link in an in-app browser.
                await (0, expo_web_browser_1.openBrowserAsync)(href, {
                    presentationStyle: expo_web_browser_1.WebBrowserPresentationStyle.AUTOMATIC,
                });
            }
        }}/>);
}
exports.ExternalLink = ExternalLink;
