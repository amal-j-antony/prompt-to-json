try {
  var pref = localStorage.getItem('prompt-studio.theme.v1')
  var dark =
    pref === 'dark' ||
    (pref !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
} catch {}
