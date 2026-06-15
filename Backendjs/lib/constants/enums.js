const TrayStatus = {
    AVAILABLE: 'available',
    ASSIGNED: 'assigned',
    CLOSED: 'closed'
};

const TrayProductStatus = {
    ALLOTED: 'alloted',
    PRIORITY_BOOKED: 'priority_booked',
    PARTIALLY_BOOKED: 'partially_booked',
    RETURNED: 'returned'
};

const TrayProductStatusTransitions = {
    [TrayProductStatus.ALLOTED]: [
        TrayProductStatus.PARTIALLY_BOOKED,
        TrayProductStatus.PRIORITY_BOOKED,
        TrayProductStatus.RETURNED,
    ],
    [TrayProductStatus.PARTIALLY_BOOKED]: [TrayProductStatus.RETURNED],
    [TrayProductStatus.PRIORITY_BOOKED]: [TrayProductStatus.RETURNED],
    [TrayProductStatus.RETURNED]: [],
};

const OrderStatus = {
    PENDING: 'pending',
    PROCESSED: 'processed',
    CANCELLED: 'cancelled',
    DISPATCHED: 'dispatched',
    PARTIALLY_DISPATCHED: 'partially_dispatched',
    HOLD_BY_TRAY: 'hold_by_tray',
    COMPLETED: 'completed',
};

const OrderStatusTransitions = {
    [OrderStatus.PENDING]: [OrderStatus.PROCESSED, OrderStatus.CANCELLED],
    [OrderStatus.PROCESSED]: [OrderStatus.HOLD_BY_TRAY, OrderStatus.CANCELLED],
    [OrderStatus.HOLD_BY_TRAY]: [OrderStatus.DISPATCHED, OrderStatus.PARTIALLY_DISPATCHED, OrderStatus.CANCELLED],
    [OrderStatus.DISPATCHED]: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
    [OrderStatus.PARTIALLY_DISPATCHED]: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
    [OrderStatus.COMPLETED]: [],
    [OrderStatus.CANCELLED]: [],
};

const OrderType = {
    PARTY_ORDER: 'party_order',
    DISTRIBUTOR_ORDER: 'distributor_order',
    EVENT_ORDER: 'event_order',
    VISIT_ORDER: 'visit_order',
    WHATSAPP_ORDER: 'whatsapp_order',
};

const EventStatus = {
    UPCOMING: 'upcoming',
    ONGOING: 'ongoing',
    PAST: 'past',
};

const AuditAction = {
    CREATE: 'create',
    UPDATE: 'update',
    DELETE: 'delete',
};

module.exports = {
    TrayStatus,
    TrayProductStatus,
    TrayProductStatusTransitions,
    OrderStatus,
    OrderStatusTransitions,
    OrderType,
    EventStatus,
    AuditAction,
};