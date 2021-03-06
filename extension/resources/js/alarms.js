/**
 * Process the events generated that are stored locally.
 *
 * Checks with local storage to see if we have any events and then sends them
 * along to the remote cloud node. If there are no events, we bail to avoid
 * making the call with no data.
 */
function processEvents() {
    var events = JSON.parse(localStorage.cfg_events);
    if (events.length === 0) {
        return false;
    }

    $.ajax({
        url: localStorage.cfg_cloudUrl + 'send-event',
        type: 'post',
        dataType: 'json',
        data: JSON.stringify({'events': events}),
        contentType: "application/json",
        success: function(data) {
            if (data.success) {
                localStorage.cfg_events = JSON.stringify([]);
                var msg = chrome.i18n.getMessage("dbgProcessedEvents");
                if (localStorage.cfg_debug) { console.log(msg); }
            }
        }
    });
}

/**
 * Update the local signature database with our definitions from the cloud.
 *
 * The storage structure for indicators is aimed to make the processing of
 * web requests as efficient as possible. Having multiple buckets to store
 * indicators based on the starting positions ensures we are only loading a
 * subset of the entire indicator definition.
 */
function databaseUpdate() {
    if (localStorage.cfg_cloudUrl === "") {
        msg = chrome.i18n.getMessage("dbgNoServer");
        if (localStorage.cfg_debug) { console.log(msg); }
        return false;
    }
    localStorage.cfg_isRunning = true;
    var url = localStorage.cfg_cloudUrl + 'get-indicators';

    $.ajax({
        url: url,
        type: 'get',
        success: function(data) {
            var indicators = data.indicators;
            for (var key in indicators) {
                localStorage[key] = JSON.stringify(indicators[key]);
            }
            localStorage.cfg_indicators = JSON.stringify(data);
            var msg = chrome.i18n.getMessage("dbgSavedItems",
                                            [data.indicatorCount]);
            if (data.indicatorCount > localStorage.cfg_lastIndicatorCount) {
                if (localStorage.cfg_notifications) {
                    chrome.notifications.create('info', {
                        type: 'basic',
                        iconUrl: ICON_LARGE,
                        title: chrome.i18n.getMessage("notifyIndicatorSyncTitle"),
                        message: msg
                    }, function(notificationId) {
                        msg = chrome.i18n.getMessage("dbgNotificationCreated");
                        if (localStorage.cfg_debug) { console.log(msg); }
                    });
                }
            }
            localStorage.cfg_lastIndicatorCount = data.indicatorCount;
            if (localStorage.cfg_debug) { console.log(msg); }
        },
        error: function(data) {
            var message = chrome.i18n.getMessage("notifyRequestError",
                                            [url, data.status]);
            chrome.notifications.create('alert', {
                type: 'basic',
                iconUrl: ICON_LARGE,
                title: chrome.i18n.getMessage("notifyRequestErrorTitle"),
                message: message
            }, function(notificationId) {
                msg = chrome.i18n.getMessage("dbgNotificationCreated");
                if (localStorage.cfg_debug) { console.log(msg); }
            });
        }
    });
}

/**
 * Chrome alarm processor that will fire any time an alarm is generated.
 */
chrome.alarms.onAlarm.addListener(function(alarm) {
    if (alarm.name == "processEvents") {
        processEvents();
    } else if (alarm.name == "databaseUpdate") {
        databaseUpdate();
    }
});

// Kick-off alarms
if (localStorage.cfg_configured) {
    chrome.alarms.create("processEvents",
                         {delayInMinutes: 0.1, periodInMinutes: 0.5});
    chrome.alarms.create("databaseUpdate",
                         {delayInMinutes: 0.1, periodInMinutes: 5});
}
