const XLSX = require('xlsx');
const { parse } = require('csv-parse/sync');
const fs = require('fs');
const path = require('path');
const partyController = require('../controllers/partyController');

/**
 * Get value from record with multiple possible column names (Excel/CSV headers).
 */
function getCell(record, ...keys) {
    for (const k of keys) {
        const v = record[k];
        if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
    }
    return null;
}

/**
 * Map a single row (CSV or Excel) to a party object.
 * All id-based fields are left as names; controller will resolve to IDs.
 */
function mapRecordToParty(record) {
    const activeVal = getCell(record, 'active', 'Active', 'is_active', 'is_active');
    const isActive = activeVal === null ? true : /^(1|true|yes|y)$/i.test(activeVal);

    return {
        party_name: getCell(record, 'party_name', 'Party Name', 'party name'),
        trade_name: getCell(record, 'trade_name', 'Trade Name', 'trade name'),
        contact_person: getCell(record, 'contact_person', 'Contact Person', 'contact person'),
        email: getCell(record, 'email', 'Email'),
        phone: getCell(record, 'phone', 'Phone'),
        address: getCell(record, 'address', 'Address'),
        country: getCell(record, 'country', 'Country'),
        state: getCell(record, 'state', 'State'),
        city: getCell(record, 'city', 'City'),
        zone: getCell(record, 'zone', 'Zone'),
        pincode: getCell(record, 'pincode', 'Pincode', 'pin code'),
        gstin: getCell(record, 'gstin', 'GSTIN', 'GST'),
        pan: getCell(record, 'pan', 'PAN'),
        active: isActive,
        credit_days: (() => {
            const v = getCell(record, 'credit_days', 'Credit Days', 'credit days');
            if (v === null) return null;
            const n = parseInt(v, 10);
            return isNaN(n) ? null : n;
        })(),
        prefered_courier: getCell(record, 'prefered_courier', 'Prefered Courier', 'preferred courier'),
        distributor: getCell(record, 'distributor', 'Distributor'),
        salesman: getCell(record, 'salesman', 'Salesman'),
    };
}

/**
 * Middleware to parse Excel/CSV for bulk create/update of parties.
 * Expects req.file (single) or req.files (array) from multer.
 * Sets req.parties (array of party objects with names for country, state, city, zone, distributor, salesman).
 */
const parsePartyFile = async (req, res, next) => {
    try {
        const file = req.file || (req.files && req.files.length > 0 ? req.files[0] : null);
        if (!file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded',
            });
        }

        const filePath = file.path || file.filepath;
        if (!filePath || !fs.existsSync(filePath)) {
            return res.status(400).json({
                success: false,
                message: 'Uploaded file path not found',
            });
        }

        const fileExt = path.extname(file.originalname || file.name || '').toLowerCase();
        let parties = [];

        if (fileExt === '.csv') {
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            const records = parse(fileContent, {
                columns: true,
                skip_empty_lines: true,
                trim: true,
            });
            parties = records.map(mapRecordToParty);
        } else if (fileExt === '.xlsx' || fileExt === '.xls') {
            const workbook = XLSX.readFile(filePath);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const records = XLSX.utils.sheet_to_json(worksheet);
            parties = records.map(mapRecordToParty);
        } else {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            return res.status(400).json({
                success: false,
                message: 'Unsupported file format. Only CSV and Excel (.xlsx, .xls) are allowed.',
            });
        }

        parties = parties.filter((p) => p.party_name);

        if (parties.length === 0) {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            return res.status(400).json({
                success: false,
                message: 'No valid parties found. Each row must have party_name.',
            });
        }

        req.parties = parties;
        req.filePaths = [filePath];

        const result = await partyController.bulkUploadParty(parties, req.user, req);

        if (req.filePaths && req.filePaths.length > 0) {
            req.filePaths.forEach((fp) => {
                if (fs.existsSync(fp)) fs.unlinkSync(fp);
            });
        }

        if (result.success) {
            return res.status(200).json({
                success: true,
                message: result.message,
                data: result.data,
                totalProcessed: parties.length,
            });
        }
        return res.status(400).json({
            success: false,
            message: result.message,
            data: result.data,
            totalProcessed: parties.length,
        });
    } catch (error) {
        if (req.filePaths && Array.isArray(req.filePaths)) {
            req.filePaths.forEach((fp) => {
                if (fp && fs.existsSync(fp)) fs.unlinkSync(fp);
            });
        }
        if (req.file && req.file.path && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        console.error('Party file parsing error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error parsing party file: ' + error.message,
        });
    }
};

module.exports = parsePartyFile;
