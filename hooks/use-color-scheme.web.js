"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useColorScheme = void 0;
const react_1 = require("react");
const react_native_1 = require("react-native");
/**
 * To support static rendering, this value needs to be re-calculated on the client side for web
 */
function useColorScheme() {
    const [hasHydrated, setHasHydrated] = (0, react_1.useState)(false);
    (0, react_1.useEffect)(() => {
        setHasHydrated(true);
    }, []);
    const colorScheme = (0, react_native_1.useColorScheme)();
    if (hasHydrated) {
        return colorScheme;
    }
    return 'light';
}
exports.useColorScheme = useColorScheme;
