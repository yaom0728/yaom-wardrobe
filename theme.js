(() => {
  const key='yaom-theme';
  const preferred=window.matchMedia?.('(prefers-color-scheme: dark)').matches?'dark':'light';
  const saved=localStorage.getItem(key);
  let current=saved==='dark'||saved==='light'?saved:preferred;

  function apply(theme,persist=false){
    current=theme;
    document.documentElement.dataset.theme=theme;
    document.documentElement.style.colorScheme=theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme==='dark'?'#0e131d':'#f5f7fa');
    if(persist)localStorage.setItem(key,theme);
    const button=document.querySelector('#theme-toggle');
    if(button){
      const dark=theme==='dark';
      button.textContent=dark?'☀':'☾';
      button.setAttribute('aria-label',dark?'라이트 모드로 전환':'다크 모드로 전환');
      button.title=dark?'라이트 모드':'다크 모드';
    }
  }

  apply(current);
  document.addEventListener('DOMContentLoaded',()=>{
    apply(current);
    document.querySelector('#theme-toggle')?.addEventListener('click',()=>apply(current==='dark'?'light':'dark',true));
  });
})();
