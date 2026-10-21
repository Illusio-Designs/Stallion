const { logAudit } = require('../utils/auditLogger');
const Event = require('../models/event');
const { EventStatus } = require('../constants/enums');
const { UNPAGINATED_CAP } = require('../utils/listSearchHelpers');
// past = already ended, ongoing = started and not ended, upcoming = not started.
// An end date picked without a time (midnight) lasts through that whole day.
function computeEventStatus(start, end, now = new Date()) {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const midnight = endDate.getHours() === 0 && endDate.getMinutes() === 0 && endDate.getSeconds() === 0;
    const endsAt = midnight ? endDate.getTime() + 24 * 60 * 60 * 1000 - 1 : endDate.getTime();
    if (now.getTime() > endsAt) return EventStatus.PAST;
    if (now >= startDate) return EventStatus.ONGOING;
    return EventStatus.UPCOMING;
}

class EventController {
    async getEvents(req, res) {
        try {
            // Refresh statuses only for rows whose status actually changed (was one
            // UPDATE per event on every request), then return a bounded list.
            const events = await Event.findAll({ order: [['end_date', 'DESC']], limit: UNPAGINATED_CAP });
            for (const event of events) {
                const eventStatus = computeEventStatus(event.start_date, event.end_date);
                if (event.event_status !== eventStatus) {
                    event.event_status = eventStatus;
                    await event.save();
                }
            }
            res.status(200).json(events);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async createEvent(req, res) {
        try {
            // no location
            const { event_name, start_date, end_date, event_location } = req.body;
            if (!event_name || !start_date || !end_date || !event_location) {
                return res.status(400).json({ error: 'All fields are required' });
            }
            const startDate = new Date(start_date);
            const endDate = new Date(end_date);
            if (startDate > endDate) {
                return res.status(400).json({ error: 'Start date must be before end date' });
            }
            const eventStatus = computeEventStatus(startDate, endDate);

            const event = await Event.create({
                event_name,
                start_date: startDate,
                end_date: endDate,
                event_status: eventStatus,
                event_location,
            });
            await logAudit({
                req,
                action: 'create',
                description: 'Event created',
                tableName: 'events',
                recordId: event.event_id,
                oldValues: null,
                newValues: event,
            });
            res.status(201).json(event);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async updateEvent(req, res) {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(400).json({ error: 'Event ID is required' });
            }
            const event = await Event.findOne({ where: { event_id: id } });
            if (!event) {
                return res.status(404).json({ error: 'Event not found' });
            }
            const { event_name, start_date, end_date, event_location } = req.body;
            const nextStart = start_date ? new Date(start_date) : new Date(event.start_date);
            const nextEnd = end_date ? new Date(end_date) : new Date(event.end_date);
            if (nextStart > nextEnd) {
                return res.status(400).json({ error: 'Start date must be before end date' });
            }
            const eventStatus = computeEventStatus(nextStart, nextEnd);
            const oldSnapshot = event.toJSON();
            const payload = {
                event_name: event_name || event.event_name,
                start_date: start_date || event.start_date,
                end_date: end_date || event.end_date,
                event_location: event_location || event.event_location,
                updated_at: new Date(),
                event_status: eventStatus || event.event_status,
            };
            await Event.update(payload, { where: { event_id: id } });
            await logAudit({
                req,
                action: 'update',
                description: 'Event updated',
                tableName: 'events',
                recordId: id,
                oldValues: oldSnapshot,
                newValues: { ...oldSnapshot, ...payload },
            });
            res.status(200).json({ message: 'Event updated successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async deleteEvent(req, res) {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(400).json({ error: 'Event ID is required' });
            }
            const event = await Event.findOne({ where: { event_id: id } });
            if (!event) {
                return res.status(404).json({ error: 'Event not found' });
            }
            const snapshot = event.toJSON();
            await event.destroy();
            await logAudit({
                req,
                action: 'delete',
                description: 'Event deleted',
                tableName: 'events',
                recordId: id,
                oldValues: snapshot,
                newValues: null,
            });
            res.status(200).json({ message: 'Event deleted successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new EventController();