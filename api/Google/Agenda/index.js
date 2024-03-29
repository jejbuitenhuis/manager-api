import Google from '..';
import { google } from 'googleapis';
import Appointment from './Appointment';
import Calendar from './Calendar';

/**
 * Get the time today started, eg. jan 1, 2019, 00:00:00.000.
 *
 * @returns {Date}
 */
function getDayStartTime() {
    let d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Get the time today will end, eg jan 1, 2019, 23:59:59.000.
 *
 * @param {Number} [offset=1] The total off days to offset the time with.
 * @returns {Date}
 */
function getDayEndTime() {
    let d = new Date();
    let tomorrow = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    return new Date(tomorrow.setSeconds(-1));
}

class Agenda extends Google {
    /**
     * Creates an instance of Agenda.
     *
     * @param {String} calendarId
     * @memberof Agenda
     */
    constructor(calendarId) {
        super();

        this.calendarId = calendarId;

        this.agenda = google.calendar({
            version: 'v3',
            auth: this.oAuth2Client
        });
    }

    /**
     * @returns {Promise<Calendar[]>}
     * @memberof Agenda
     */
    getCalendars() {
        return new Promise((resolve, reject) => {
            this.agenda.calendarList
                .list({
                    showHidden: true
                })
                .then(r => r.data.items)
                .then(res => {
                    /**
                     * @type {Calendar[]}
                     */
                    let ret = [];

                    res.forEach(calendar => {
                        ret.push(
                            new Calendar({
                                id: calendar.id,
                                summary: calendar.summary,
                                timezone: calendar.timeZone,
                                color: {
                                    foreground: calendar.foregroundColor,
                                    background: calendar.backgroundColor
                                },
                                hidden: !calendar.selected
                            })
                        );
                    });

                    resolve(ret);
                })
                .catch(reject);
        });
    }

    /**
     * Get the appointents between {@link start} and {@link end}.
     *
     * @param {Date} [start]
     * @param {Date} [end]
     * @returns {Promise<Appointment[]>}
     * @memberof Agenda
     */
    getAppointments(start, end) {
        return new Promise((resolve, reject) => {
            start = new Date(start || getDayStartTime());
            end = new Date(end || getDayEndTime());

            if (start.getTime() >= end.getTime()) {
                return reject(`the start time should be before the end time`);
            }

            this.agenda.colors
                .get()
                .then(r => r.data.event)
                .then(colors => {
                    this.agenda.events
                        .list({
                            calendarId: this.calendarId || 'primary',
                            timeMin: start,
                            timeMax: end,
                            singleEvents: true,
                            orderBy: 'startTime',
                            prettyPrint: true, // TODO: do we really include this?
                            showDeleted: false // TODO: do we really exclude this?
                        })
                        .then(r => r.data.items)
                        .then(res => {
                            let ret = [];

                            res.forEach(event => {
                                ret.push(
                                    new Appointment({
                                        id: event.id,
                                        title: event.summary,
                                        description: event.description,
                                        location: event.location,
                                        color: colors[event.colorId || 1],
                                        time: {
                                            start: new Date(
                                                event.start.dateTime ||
                                                    event.start.date
                                            ),
                                            end: new Date(
                                                event.end.dateTime ||
                                                    event.end.date
                                            )
                                        }
                                    })
                                );
                            });

                            resolve(ret);
                        })
                        .catch(reject);
                })
                .catch(reject);
        });
    }

    /**
     * Get the ammount of minutes your busy per day, for the next 7 days.
     *
     * @param {Date} [start] The starting date.
     * @memberof Agenda
     */
    getBusyTime(start) {
        return new Promise(async (resolve, reject) => {
            const TOTAL_DAYS = 7;
            start = new Date(start || getDayStartTime());
            let ret = [];

            try {
                for (let dayN = 0; dayN < TOTAL_DAYS; dayN++) {
                    let startDate = new Date(start.getFullYear(), start.getMonth(), start.getDate() + dayN);
                    let endDate = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1 + dayN);
                    ret[dayN] = 0;

                    let appointments = await this.getAppointments(startDate, endDate);

                    for (let i = 0; i < appointments.length; i++) {
                        let startTime = appointments[i].time.start;
                        let endTime = appointments[i].time.end;
                        let startMinutes = startTime.getHours() * 60 + startTime.getMinutes();
                        let endMinutes = endTime.getHours() * 60 + endTime.getMinutes();
                        let delta = endMinutes - startMinutes;

                        ret[dayN] += parseFloat( (delta / 60).toFixed(2) );
                    }
                }

                resolve(ret);
            } catch (e) {
                reject(e);
            }
        });
    }
}

export default Agenda;
