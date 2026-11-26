// Runs before the page paints so a dark choice never flashes white.
const SCRIPT = `(function(){try{var c=localStorage.getItem('stl-theme');if(c!=='light'&&c!=='dark')c='system';var d=c==='dark'||(c==='system'&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);var t=d?'dark':'light';var r=document.documentElement;r.setAttribute('data-theme',t);r.style.colorScheme=t;}catch(e){}})();`;

export default function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
}
