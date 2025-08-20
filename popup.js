function fmt(ms){
  const m = Math.floor(ms/60000);
  const s = Math.floor((ms%60000)/1000);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function classify(domain, sets){
  if (sets.productive.includes(domain)) return "productive";
  if (sets.unproductive.includes(domain)) return "unproductive";
  return "neutral";
}

chrome.runtime.sendMessage({ type:"getToday" }, ({ map, sets }) => {
  const list = document.getElementById("list");
  if (!map || Object.keys(map).length === 0) {
    list.innerHTML = `<div class="empty">No time tracked yet. Keep a tab active while you work.</div>`;
    return;
  }

  // Totals by category
  let tProd=0, tUnprod=0, tNeut=0;
  const rows = Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,30);
  list.innerHTML = rows.map(([domain, ms]) => {
    const cat = classify(domain, sets);
    if (cat==="productive") tProd+=ms; else if (cat==="unproductive") tUnprod+=ms; else tNeut+=ms;
    return `<div class="item"><span class="dom">${domain}</span><span>${fmt(ms)}</span></div>`;
  }).join("");

  document.getElementById("tProd").textContent = fmt(tProd);
  document.getElementById("tUnprod").textContent = fmt(tUnprod);
  document.getElementById("tNeut").textContent = fmt(tNeut);
});
