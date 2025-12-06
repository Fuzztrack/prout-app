"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizePhone = void 0;
function normalizePhone(number) {
    if (!number)
        return "";
    return number
        .replace(/\s+/g, "")
        .replace(/-/g, "")
        .replace(/\./g, "")
        .replace(/\(/g, "")
        .replace(/\)/g, "")
        .replace(/^\+33/, "0")
        .trim();
}
exports.normalizePhone = normalizePhone;
