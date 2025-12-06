"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HelloWave = void 0;
const react_native_reanimated_1 = __importDefault(require("react-native-reanimated"));
function HelloWave() {
    return (<react_native_reanimated_1.default.Text style={{
            fontSize: 28,
            lineHeight: 32,
            marginTop: -6,
            animationName: {
                '50%': { transform: [{ rotate: '25deg' }] },
            },
            animationIterationCount: 4,
            animationDuration: '300ms',
        }}>
      👋
    </react_native_reanimated_1.default.Text>);
}
exports.HelloWave = HelloWave;
