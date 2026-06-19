const { logAudit } = require('../utils/auditLogger');
const Event = require('../models/event');
const { EventStatus } = require('../constants/enums');
class EventController {
    async getEvents(req, res) {
        try {
            const events = await Event.findAll();
            for (const event of events) {
                let eventStatus;
                const startDate = new Date(event.start_date);
                const endDate = new Date(event.end_date);
                if (startDate < new Date()) {
                    eventStatus = EventStatus.PAST;
                } else if (startDate > new Date() && endDate < new Date()) {
                    eventStatus = EventStatus.ONGOING;
                } else {
                    eventStatus = EventStatus.UPCOMING;
                }
                event.event_status = eventStatus;
                await event.save();
            }
            const updatedEvents = await Event.findAll();
            res.status(200).json(updatedEvents);
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
            let eventStatus;
            if (startDate < new Date()) {
                eventStatus = EventStatus.PAST;
            } else if ((startDate > new Date() && endDate < new Date()) || startDate == new Date()) {
                eventStatus = EventStatus.ONGOING;
            } else {
                eventStatus = EventStatus.UPCOMING;
            }

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
            let eventStatus;
            if (start_date && end_date) {
                const startDate = new Date(start_date);
                const endDate = new Date(end_date);
                if (startDate > endDate) {
                    return res.status(400).json({ error: 'Start date must be before end date' });
                }
                if (startDate < new Date()) {
                    eventStatus = EventStatus.PAST;
                } else if ((startDate > new Date() && endDate < new Date()) || startDate == new Date()) {
                    eventStatus = EventStatus.ONGOING;
                } else {
                    eventStatus = EventStatus.UPCOMING;
                }
            }
            if (start_date && start_date != event.start_date) {
                const startDate = new Date(start_date);
                const endDate = new Date(event.end_date);
                if (startDate > endDate) {
                    return res.status(400).json({ error: 'Start date must be before end date' });
                }
                if (startDate < new Date()) {
                    eventStatus = EventStatus.PAST;
                } else if ((startDate > new Date() && endDate < new Date()) || startDate == new Date()) {
                    eventStatus = EventStatus.ONGOING;
                } else {
                    eventStatus = EventStatus.UPCOMING;
                }
            }
            if (end_date && end_date != event.end_date) {
                const startDate = new Date(event.start_date);
                const endDate = new Date(end_date);
                if (startDate > endDate) {
                    return res.status(400).json({ error: 'Start date must be before end date' });
                }
                if (endDate < new Date()) {
                    eventStatus = EventStatus.PAST;
                } else if ((startDate > new Date() && endDate < new Date()) || startDate == new Date()) {
                    eventStatus = EventStatus.ONGOING;
                } else {
                    eventStatus = EventStatus.UPCOMING;
                }
            }
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