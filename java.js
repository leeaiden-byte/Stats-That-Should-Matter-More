const FILES = {
  batter: {
    AL: { classic: "AL_classic_full.csv", saber: "AL_saber_full.csv" },
    NL: { classic: "NL_classic_full.csv", saber: "NL_saber_full.csv" },
  },
  pitcher: {
    SP: {
      AL: { classic: "AL_starter_classic_full.csv", saber: "AL_starter_saber_full.csv" },
      NL: { classic: "NL_starter_classic_full.csv", saber: "NL_starter_saber_full.csv" },
    },
    RP: {
      AL: { classic: "AL_relief_classic_full.csv", saber: "AL_relief_saber_full.csv" },
      NL: { classic: "NL_relief_classic_full.csv", saber: "NL_relief_saber_full.csv" },
    },
  },
};

const state = {
  league: "NL",
  kind: "batter",  
  ptype: "SP",      
  mode: "classic",  
  headers: [],
  rows: [],
  sortKey: null,
  sortDir: "asc",
  search: ""
};

function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') { cell += '"'; i++; }
      else if (char === '"') { inQuotes = false; }
      else { cell += char; }
    } else {
      if (char === '"') inQuotes = true;
      else if (char === ",") { row.push(cell); cell = ""; }
      else if (char === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
      else if (char !== "\r") { cell += char; }
    }
  }
  if (cell.length > 0 || inQuotes || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function smartCoerce(value) {
  if (value === null || value === undefined) return value;
  const v = String(value).trim();
  if (v === "") return v;
  if (/^-?\d+(\.\d+)?%$/.test(v)) return parseFloat(v.replace("%",""));
  if (/^-?\d+(\.\d+)?$/.test(v))  return parseFloat(v);
  return value;
}

function guessPlayerNameKey(headers) {
  const keys = ["Name", "Player", "PLAYER", "Player Name", "선수", "이름"];
  for (const k of keys) if (headers.includes(k)) return k;
  const likely = headers.find(h => /player|name|선수|이름/i.test(h));
  return likely || null;
}


function applyTheme() {
  document.body.dataset.league = state.league;
}

$(function () {
  initUI();
  loadAndRender();
  applyTheme(); 
});

function resolveFile() {
  if (state.kind === "batter") {
    return FILES.batter[state.league][state.mode];
  } else {
    return FILES.pitcher[state.ptype][state.league][state.mode];
  }
}

function loadAndRender() {
  const file = resolveFile();
  if (!file) {
    console.error("파일 매핑이 없습니다:", state);
    updateTitle("(매핑 오류)");
    return;
  }

  $.ajax({ url: file, dataType: "text" })
    .done(text => {
      const cleaned = text.replace(/^\uFEFF/, "").trim();
      const grid = parseCSV(cleaned).filter(row => row.length > 0 && row.some(c => String(c).trim() !== ""));
      if (grid.length === 0) {
        state.headers = [];
        state.rows = [];
        renderTable();
        updateTitle("(빈 데이터)");
        return;
      }

      state.headers = grid[0].map(h => h.trim());
      state.rows = grid.slice(1).map(r => {
        const obj = {};
        state.headers.forEach((h, i) => obj[h] = smartCoerce(r[i] ?? ""));
        return obj;
      });

      state.sortKey = null;
      renderTable();
      updateTitle();
      applyTheme(); 
    })
    .fail((xhr, status, err) => {
      console.error("CSV 로드 실패:", status, err);
      state.headers = [];
      state.rows = [];
      renderTable();
      updateTitle("(데이터 로드 실패)");
    });
}

function updateTitle(extra="") {
  const kindText = (state.kind === "batter") ? "Batter" : (state.ptype === "SP" ? "Starting Pitcher" : "Relief Pitcher");
  const modeText = (state.mode === "classic") ? "Classic" : "Saber";
  const base = `${state.league} • ${kindText} • ${modeText}`;
  $("#table-title").text(extra ? `${base} ${extra}` : base);
}

function renderTable() {
  const thead = $("#tableHead");
  const tbody = $("#tableBody");
  thead.empty();
  tbody.empty();

  if (state.headers.length === 0) {
    thead.append(`<tr><th>데이터 없음</th></tr>`);
    return;
  }

  const makeSortIco = (key) => {
    if (state.sortKey !== key) return `<span class="sort-ico">↕</span>`;
    return state.sortDir === "asc" ? `<span class="sort-ico">↑</span>` : `<span class="sort-ico">↓</span>`;
  };

  const trh = $("<tr/>");
  state.headers.forEach(h => {
    const th = $(`<th>${h}${makeSortIco(h)}</th>`);
    th.on("click", () => {
      if (state.sortKey === h) {
        state.sortDir = (state.sortDir === "asc" ? "desc" : "asc");
      } else {
        state.sortKey = h;
        state.sortDir = "asc";
      }
      renderTable();
    });
    trh.append(th);
  });
  thead.append(trh);

  const search = state.search.trim().toLowerCase();
  const nameKey = guessPlayerNameKey(state.headers);
  let rows = state.rows.slice();

  if (search && nameKey) {
    rows = rows.filter(r => String(r[nameKey] ?? "").toLowerCase().includes(search));
  }

  if (state.sortKey) {
    const key = state.sortKey;
    const dir = state.sortDir === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      const va = a[key];
      const vb = b[key];
      const na = typeof va === "number";
      const nb = typeof vb === "number";
      if (na && nb) return (va - vb) * dir;
      return String(va ?? "").localeCompare(String(vb ?? ""), undefined, { numeric: true }) * dir;
    });
  }

  const frag = $(document.createDocumentFragment());
  rows.forEach(r => {
    const tr = $("<tr/>");
    state.headers.forEach(h => tr.append($("<td/>").text(r[h])));
    frag.append(tr);
  });
  tbody.append(frag);

  thead.find("th").each((i, el) => {
    const h = state.headers[i];
    $(el).html(`${h}${makeSortIco(h)}`).off("click").on("click", () => {
      if (state.sortKey === h) {
        state.sortDir = (state.sortDir === "asc" ? "desc" : "asc");
      } else {
        state.sortKey = h;
        state.sortDir = "asc";
      }
      renderTable();
    });
  });
}

function initUI() {
  $(".chip").on("click", function () {
    const filter = $(this).data("filter");
    const val = $(this).data("value");
    $(`.chip[data-filter="${filter}"]`).removeClass("active");
    $(this).addClass("active");

    if (filter === "league") state.league = val;
    if (filter === "kind")   state.kind   = val;
    if (filter === "ptype")  state.ptype  = val;
    if (filter === "mode")   state.mode   = val;

    if (state.kind === "pitcher") $("#pitcher-subgroup").show();
    else $("#pitcher-subgroup").hide();

    applyTheme();
    loadAndRender();
  });

  if (state.kind === "pitcher") $("#pitcher-subgroup").show();

  $("#searchInput").on("input", function () {
    state.search = $(this).val();
    renderTable();
  });

  $("#savePost").on("click", savePost);
  renderPosts();
}

function savePost() {
  const title = $("#postTitle").val().trim();
  const body = $("#postBody").val().trim();
  if (!title || !body) {
    alert("제목과 본문을 모두 입력하세요.");
    return;
  }
  const posts = loadPosts();
  posts.unshift({
    id: Date.now(),
    title,
    body,
    when: new Date().toISOString()
  });
  localStorage.setItem("wba_posts", JSON.stringify(posts));
  $("#postTitle").val("");
  $("#postBody").val("");
  renderPosts();
}

function loadPosts() {
  try {
    return JSON.parse(localStorage.getItem("wba_posts") || "[]");
  } catch {
    return [];
  }
}

function renderPosts() {
  const list = $("#postsList").empty();
  const posts = loadPosts();
  if (posts.length === 0) {
    list.append(`<div class="post"><small>아직 게시된 칼럼이 없습니다.</small></div>`);
    return;
  }
  posts.forEach(p => {
    const el = $(`
      <div class="post">
        <h3>${escapeHTML(p.title)}</h3>
        <small>${formatWhen(p.when)}</small>
        <p>${nl2br(escapeHTML(p.body))}</p>
      </div>
    `);
    list.append(el);
  });
}

function formatWhen(iso) {
  try {
    const d = new Date(iso);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth()+1).padStart(2,"0");
    const dd = String(d.getDate()).padStart(2,"0");
    const hh = String(d.getHours()).padStart(2,"0");
    const mi = String(d.getMinutes()).padStart(2,"0");
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
  } catch { return iso; }
}

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"
  }[c]));
}
function nl2br(s) { return s.replace(/\n/g, "<br/>"); }