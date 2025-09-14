"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TimeUtils = void 0;
class TimeUtils {
    static convertToMilliseconds(unit, value) {
        const millisecondsPerSecond = 1000;
        const millisecondsPerMinute = 60 * millisecondsPerSecond;
        const millisecondsPerHour = 60 * millisecondsPerMinute;
        const millisecondsPerDay = 24 * millisecondsPerHour;
        const millisecondsPerWeek = 7 * millisecondsPerDay;
        switch (unit.toLowerCase()) {
            case 'hours':
                return value * millisecondsPerHour;
            case 'minutes':
                return value * millisecondsPerMinute;
            case 'seconds':
                return value * millisecondsPerSecond;
            case 'days':
                return value * millisecondsPerDay;
            case 'weeks':
                return value * millisecondsPerWeek;
            default:
                throw new Error('Invalid time unit. Supported units are "hours", "minutes", "seconds", "days", or "weeks".');
        }
    }
    static convertToSeconds(type, value) {
        const secondsInMinute = 60;
        const minutesInHour = 60;
        const hoursInDay = 24;
        const daysInMonth = 30; // Assuming an average month
        let totalSeconds;
        switch (type.toLowerCase()) {
            case 'hours':
                totalSeconds = value * secondsInMinute * minutesInHour;
                break;
            case 'days':
                totalSeconds = value * hoursInDay * minutesInHour * secondsInMinute;
                break;
            case 'years':
                totalSeconds = value * 365 * hoursInDay * minutesInHour * secondsInMinute;
                break;
            case 'minutes':
                totalSeconds = value * secondsInMinute;
                break;
            case 'months':
                totalSeconds = value * daysInMonth * hoursInDay * minutesInHour * secondsInMinute;
                break;
            default:
                totalSeconds = 0;
        }
        return totalSeconds;
    }
}
exports.TimeUtils = TimeUtils;
