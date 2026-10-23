const Tray = require('../models/Tray');
const TrayProducts = require('../models/TrayProducts');
const SalesmanTray = require('../models/SalesmanTray');
const Salesman = require('../models/Salesman');
const { TrayStatus } = require('../constants/enums');

// A salesman's tray follows the salesman:
//  - salesman active   -> tray is 'assigned' (a returning salesman gets the same tray back)
//  - salesman inactive -> the tray stays as it is until every piece has been moved to another
//                         tray or back to the warehouse; the moment it holds 0 pieces it becomes
//                         'inactive' by itself.

async function trayPieceCount(trayId, transaction) {
    const rows = await TrayProducts.findAll({ where: { tray_id: trayId }, transaction });
    return rows.reduce((sum, r) => sum + (Number(r.qty) || 0), 0);
}

async function syncTrayStatus(trayId, transaction) {
    const link = await SalesmanTray.findOne({ where: { tray_id: trayId, released_at: null }, transaction });
    if (!link) return null;
    const salesman = await Salesman.findOne({ where: { salesman_id: link.salesman_id }, transaction });
    const tray = await Tray.findOne({ where: { tray_id: trayId }, transaction });
    if (!salesman || !tray) return null;
    let next = tray.tray_status;
    if (salesman.is_active !== false) {
        if (tray.tray_status === TrayStatus.INACTIVE) next = TrayStatus.ASSIGNED;
    } else if ((await trayPieceCount(trayId, transaction)) === 0) {
        next = TrayStatus.INACTIVE;
    }
    if (next !== tray.tray_status) {
        await Tray.update({ tray_status: next, updated_at: new Date() }, { where: { tray_id: trayId }, transaction });
    }
    return next;
}

async function syncSalesmanTrays(salesmanId, transaction) {
    const links = await SalesmanTray.findAll({ where: { salesman_id: salesmanId, released_at: null }, transaction });
    for (const link of links) await syncTrayStatus(link.tray_id, transaction);
}

module.exports = { trayPieceCount, syncTrayStatus, syncSalesmanTrays };
