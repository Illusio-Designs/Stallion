// Records are never deleted: orders, reports, salesmen, parties and the lists that
// refer to them all need the history. Use the inactive / cancelled / closed state instead.
function noDelete(what = 'This record') {
    return (req, res) => res.status(409).json({
        error: `${what} cannot be deleted because its records are kept. Make it inactive instead.`,
    });
}

module.exports = noDelete;
