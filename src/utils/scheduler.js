/**
 * scheduler.js
 * homebridge-sprinklers
 *
 * @copyright 2024 Hendrik Meinl
 */

"use strict";

class Scheduler {

    constructor() {
        this.timer = null;
        this.jobs  = [];
    }

    add(timestamp, callback) {
        this.jobs.push({
            timestamp: timestamp,
            callback: callback,
        });
        this.jobs.sort((a, b) => a.timestamp - b.timestamp);
    }

    run() {
        const job = this.jobs[0];
        if (job) {
            const delay = Math.max(0, job.timestamp - Date.now());
            this.timer = setTimeout(() => {
                if (job.callback && typeof job.callback === "function") {
                    job.callback();
                }
                this.jobs.shift();
                this.run();
            }, delay);
        }
    }

    cancel() {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        this.jobs = [];
    }
}

exports.Scheduler = Scheduler;
