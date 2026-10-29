export const rs = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
export const dateLong = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
export const dateShort = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
