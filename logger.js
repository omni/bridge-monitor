'use strict';
module.exports = function (name) {
    var lastlog = 0;

    function log(...args) {
        var now = new Date();
        console.log(now.toISOString(), `(+${lastlog?now.getTime()-lastlog : 0}ms)`, `[${name}]`, ...args);
        lastlog = now.getTime();
    }

    function error(...args) {
        var now = new Date();
        console.error(now.toISOString(), `[${name}]`, ...args);
    }

    var dbg;
    if (process.env.DEBUG) {    
        dbg = (...args) => {
            log(...args);
        }
    }
    else {
        dbg = () => {}
    }

    return {
        log,
        error,
        debug: dbg,
    };
};
