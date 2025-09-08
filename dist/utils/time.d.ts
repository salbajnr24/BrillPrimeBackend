export declare class TimeUtils {
    static convertToMilliseconds(unit: 'hours' | 'minutes' | 'seconds' | 'days' | 'weeks', value: number): number;
    static convertToSeconds(type: 'hours' | 'days' | 'years' | 'minutes' | 'months', value: number): number;
}
