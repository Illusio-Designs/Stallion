// Open problems found in the code review, in plain words. Shown on the admin-only
// "Known Problems" page. Remove an entry here once it is fixed.
// severity: 1 = Very serious, 2 = Serious, 3 = Medium, 4 = Small
const KNOWN_ISSUES = [
  {
    "group": "Security: people can get in where they should not",
    "severity": 2,
    "title": "Anyone logged in can see every party's details",
    "what": "A list call returns phone, GSTIN, PAN and address for all parties. A party user can also get a stranger's party by accident.",
    "fix": "Allow it only for managers and only for their own area.",
    "affects": [
      "Party",
      "Admin / manager"
    ]
  },
  {
    "group": "Security: people can get in where they should not",
    "severity": 4,
    "title": "Logout does not really log out",
    "what": "Logout does not cancel the old session, and refresh gives a shorter session than login.",
    "fix": "Add a proper refresh and logout.",
    "affects": [
      "Everyone"
    ]
  },
  {
    "group": "Security: people can get in where they should not",
    "severity": 4,
    "title": "Small open doors",
    "what": "The list of roles can be read without login. A user can change their own phone with no OTP. A party that has orders cannot be deleted and shows an ugly error.",
    "fix": "Close each one.",
    "affects": [
      "Everyone"
    ]
  },
  {
    "group": "Orders and stock go wrong",
    "severity": 2,
    "title": "A cancelled order can be brought back without taking stock out again",
    "what": "Cancel an order and stock goes back. Make it live again and stock stays as if it was never sold, so the shop thinks it has more than it does. A delivered order can also be cancelled.",
    "fix": "Do not allow moving out of cancelled or completed.",
    "affects": [
      "Admin / manager"
    ]
  },
  {
    "group": "Orders and stock go wrong",
    "severity": 2,
    "title": "Two cancels at the same time give back stock twice",
    "what": "If two people cancel one order together, the stock is added back two times.",
    "fix": "Do the cancel as one safe step.",
    "affects": [
      "Admin / manager"
    ]
  },
  {
    "group": "Orders and stock go wrong",
    "severity": 2,
    "title": "A tray that is partly used cannot supply orders",
    "what": "After some pieces are taken from a tray, the tray is marked in a way that new orders cannot use, so orders fail with \"not enough stock\" even though there is stock.",
    "fix": "Let partly used trays supply orders.",
    "affects": [
      "Salesman",
      "Party"
    ]
  },
  {
    "group": "Orders and stock go wrong",
    "severity": 2,
    "title": "Uploading products in bulk breaks stock totals",
    "what": "The sheet updates the warehouse number but not the total. Orders then oversell or are wrongly refused. A failed row is still counted as done.",
    "fix": "Update the total too and report failed rows.",
    "affects": [
      "Admin / manager"
    ]
  },
  {
    "group": "Orders and stock go wrong",
    "severity": 2,
    "title": "Adding or removing tray products can overwrite stock",
    "what": "If an order is placed at the same moment, the tray change erases it. Returning a tray never puts stock back.",
    "fix": "Change stock in one safe step and put it back on return.",
    "affects": [
      "Admin / manager"
    ]
  },
  {
    "group": "Orders and stock go wrong",
    "severity": 2,
    "title": "Visit and event orders have no distributor",
    "what": "The distributor is only added for party orders. A distributor does not see visit orders for their own parties.",
    "fix": "Always use the party's distributor.",
    "affects": [
      "Distributor",
      "Salesman"
    ]
  },
  {
    "group": "Orders and stock go wrong",
    "severity": 3,
    "title": "A user can place orders under another salesman",
    "what": "A party user can send someone else's salesman name and give that salesman the sale. Any salesman can order for any party.",
    "fix": "Use the logged-in salesman, and check the party belongs to them.",
    "affects": [
      "Salesman",
      "Party"
    ]
  },
  {
    "group": "Orders and stock go wrong",
    "severity": 3,
    "title": "Real errors look like \"bad request\"",
    "what": "When the database is busy or two orders clash, the app says 400 instead of a proper error, and may fail for no reason.",
    "fix": "Return the right errors and try again on clashes.",
    "affects": [
      "Everyone"
    ]
  },
  {
    "group": "Orders and stock go wrong",
    "severity": 4,
    "title": "Small order rules are missing",
    "what": "Half quantities pass, a negative quantity is accepted in the price quote, the same product twice repeats the discount, and an offer that ends on a date stops at the start of that day.",
    "fix": "Add checks for each.",
    "affects": [
      "Admin / manager",
      "Salesman"
    ]
  },
  {
    "group": "Orders and stock go wrong",
    "severity": 4,
    "title": "Editing a product without brand fails",
    "what": "A tray manager updating only stock gets an error.",
    "fix": "Skip the brand check when not given.",
    "affects": [
      "Admin / manager"
    ]
  },
  {
    "group": "Orders and stock go wrong",
    "severity": 3,
    "title": "Orders page: no \"New order\" button once orders exist",
    "what": "The only button is in the empty page. After the first order, admins cannot create one from this page.",
    "fix": "Add the button to the table.",
    "affects": [
      "Admin / manager"
    ]
  },
  {
    "group": "Orders and stock go wrong",
    "severity": 3,
    "title": "Create-order form shows price 0",
    "what": "The form reads the wrong price field, so it always shows 0 and the user types a fake price that the server ignores. Edit is shown to roles that cannot use it.",
    "fix": "Show the wholesale price and hide Edit for others.",
    "affects": [
      "Admin / manager"
    ]
  },
  {
    "group": "Login and sign out",
    "severity": 3,
    "title": "Logging out shows \"session expired\"",
    "what": "After pressing Log out, the user sees a red \"session expired\" message and lands on the login page instead of Home.",
    "fix": "Mark logout as done by the user first.",
    "affects": [
      "Everyone"
    ]
  },
  {
    "group": "Login and sign out",
    "severity": 3,
    "title": "Logged-out users see strange pages",
    "what": "Dashboard and Cart open without login, then show \"session expired\" and do not come back to the same page after login. The cart can even send an order with no login.",
    "fix": "Check login first and remember the page.",
    "affects": [
      "Everyone"
    ]
  },
  {
    "group": "Login and sign out",
    "severity": 3,
    "title": "Users with two roles get the wrong role",
    "what": "Someone who is both sales manager and salesman sometimes gets \"Salesman not found\" or sees the wrong data.",
    "fix": "Always use all roles of the user.",
    "affects": [
      "Admin / manager",
      "Salesman"
    ]
  },
  {
    "group": "Login and sign out",
    "severity": 4,
    "title": "Small login problems",
    "what": "The code boxes hold one digit so phone autofill breaks. There is no \"Change number\" link. After a wrong code the box does not get focus. Register page is empty.",
    "fix": "Fix each.",
    "affects": [
      "Everyone"
    ]
  },
  {
    "group": "Salesman work",
    "severity": 2,
    "title": "Adding an expense with bill photos always fails",
    "what": "The photos are uploaded before the expense exists, and the server needs the expense first. The salesman sees \"Expense ID is required\" and nothing saves.",
    "fix": "Save the expense first, then add the photos.",
    "affects": [
      "Salesman"
    ]
  },
  {
    "group": "Salesman work",
    "severity": 2,
    "title": "Expense and sales managers see the wrong page",
    "what": "They see \"My Expenses\" like a salesman: an empty list, an Add button that fails, and no Approve button.",
    "fix": "Show the manager page to office roles.",
    "affects": [
      "Admin / manager"
    ]
  },
  {
    "group": "Salesman work",
    "severity": 3,
    "title": "An approved expense can be changed",
    "what": "After approval the salesman can still raise the amount from 500 to 50,000.",
    "fix": "Lock an expense after approval.",
    "affects": [
      "Salesman",
      "Admin / manager"
    ]
  },
  {
    "group": "Salesman work",
    "severity": 3,
    "title": "Expense page calls the server in a different way",
    "what": "It uses the old address and headers the firewall rejects, so bills and errors can fail, and an expired login shows a raw error.",
    "fix": "Use the same way as the rest of the app.",
    "affects": [
      "Salesman",
      "Admin / manager"
    ]
  },
  {
    "group": "Salesman work",
    "severity": 3,
    "title": "Removing a tray from a salesman does not remove it",
    "what": "The record stays, so the tray can be given twice.",
    "fix": "Delete the right record.",
    "affects": [
      "Salesman",
      "Admin / manager"
    ]
  },
  {
    "group": "Salesman work",
    "severity": 4,
    "title": "Visit and target forms miss checks",
    "what": "Out time can be before in time, the next visit can be in the past, and targets cannot be set for visit, WhatsApp or event orders.",
    "fix": "Add the checks and the order types.",
    "affects": [
      "Salesman"
    ]
  },
  {
    "group": "Salesman work",
    "severity": 3,
    "title": "Events: errors hide the whole table",
    "what": "A mistake in the event form replaces the table with \"Couldn't load events\" and the user sees no message in the form.",
    "fix": "Show the message in the form.",
    "affects": [
      "Admin / manager"
    ]
  },
  {
    "group": "Salesman work",
    "severity": 4,
    "title": "Events: current events never show",
    "what": "An event that has started is marked as past, so \"ongoing\" never appears.",
    "fix": "Compare with the end date.",
    "affects": [
      "Admin / manager"
    ]
  },
  {
    "group": "Salesman work",
    "severity": 4,
    "title": "Salesman tray, tray manager and distributor small problems",
    "what": "A distributor can never be made inactive, and a commission of 0 is ignored.",
    "fix": "Fix the checks.",
    "affects": [
      "Admin / manager",
      "Distributor"
    ]
  },
  {
    "group": "Dashboard and lists",
    "severity": 3,
    "title": "A new party without a zone disappears",
    "what": "A salesman adds a party with no zone and cannot see it in their list or in the order pickers.",
    "fix": "Show parties that have no zone.",
    "affects": [
      "Salesman",
      "Distributor"
    ]
  },
  {
    "group": "Dashboard and lists",
    "severity": 3,
    "title": "Party bulk upload can mix up parties",
    "what": "Parties are matched by name or email, so two shops with the same name merge. Empty cells erase data, and one bad row stops the upload after others are saved.",
    "fix": "Match by phone or GSTIN and update only filled cells.",
    "affects": [
      "Admin / manager"
    ]
  },
  {
    "group": "Dashboard and lists",
    "severity": 3,
    "title": "New party can get someone else as salesman",
    "what": "If no salesman is chosen, any salesman of that state is picked, and the creator may then be unable to edit it.",
    "fix": "Use the person who created it.",
    "affects": [
      "Salesman",
      "Distributor"
    ]
  },
  {
    "group": "Dashboard and lists",
    "severity": 4,
    "title": "Menu gaps for some roles",
    "what": "Sales manager cannot open Party or Orders although the server allows it. A role missing from the list sees an empty menu.",
    "fix": "Match the menu to what the server allows.",
    "affects": [
      "Admin / manager"
    ]
  }
];

export default KNOWN_ISSUES;
