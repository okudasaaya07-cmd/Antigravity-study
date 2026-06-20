/* ==========================================================================
   La Librairie — app.js
   Google Books API를 활용한 클라이언트 사이드 도서 검색 / AI 맞춤 추천 /
   상세보기 / 리뷰(평점) 기능을 제공합니다. 서버나 빌드 과정 없이
   index.html에 정의된 onclick 핸들러들과 1:1로 맞물려 동작합니다.
   ========================================================================== */

(function () {
  "use strict";

  /* ---------------------------------------------------------------------
   * 0. 전역 상태
   * ------------------------------------------------------------------- */
  const state = {
    activeView: "home",
    lastMainView: "home",
    selectedGenres: new Set(),
    booksCache: {},
    currentDetailBookId: null,
    editingReviewId: null,
    pendingRating: 0,

    /* 검색 페이지네이션 상태 */
    currentQuery: "",
    currentSearchType: "",
    currentPage: 0,      // 0-based (0 = 첫 번째 페이지)
    hasMoreResults: false,
    isLoadingMore: false,
  };

  const REVIEWS_KEY = "laLibrairieReviews_v1";
  const BOOKS_API = "https://www.googleapis.com/books/v1/volumes";
  const PAGE_SIZE = 40;          // Google Books API 허용 최대 maxResults
  const INITIAL_PAGES = 3;       // 첫 검색 시 동시에 가져올 페이지 수 (3 × 40 = 120)
  const LOAD_MORE_PAGES = 2;     // "더 불러오기" 클릭 시 가져올 페이지 수 (2 × 40 = 80)

  /* ---------------------------------------------------------------------
   * 1. 공통 유틸
   * ------------------------------------------------------------------- */
  function escapeHTML(str) {
    if (str == null) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function truncate(str, n) {
    if (!str) return "";
    return str.length > n ? str.slice(0, n).trim() + "…" : str;
  }

  function sanitizeDescription(desc) {
    if (!desc) return "";
    return desc
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<[^>]+>/g, "")
      .trim();
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function showLoader(message) {
    const loader = document.getElementById("global-loader");
    const msgEl = document.getElementById("loader-message");
    if (msgEl) msgEl.textContent = message || "불러오는 중입니다...";
    if (loader) loader.style.display = "flex";
  }

  function hideLoader() {
    const loader = document.getElementById("global-loader");
    if (loader) loader.style.display = "none";
  }

  function notify(message) {
    let toast = document.getElementById("app-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "app-toast";
      Object.assign(toast.style, {
        position: "fixed",
        bottom: "32px",
        left: "50%",
        transform: "translateX(-50%)",
        backgroundColor: "var(--color-text-primary)",
        color: "var(--color-white)",
        padding: "14px 28px",
        borderRadius: "3px",
        fontSize: "14px",
        zIndex: "2000",
        boxShadow: "var(--shadow-subtle)",
        opacity: "0",
        transition: "opacity .3s",
        maxWidth: "90vw",
        textAlign: "center",
      });
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.opacity = "1";
    clearTimeout(window.__appToastTimer);
    window.__appToastTimer = setTimeout(() => {
      toast.style.opacity = "0";
    }, 2600);
  }

  /* ---------------------------------------------------------------------
   * 2. 화면 전환 (네비게이션)
   * ------------------------------------------------------------------- */
  function showView(viewId) {
    document.querySelectorAll(".view-section").forEach((el) => el.classList.remove("active"));
    const target = document.getElementById("view-" + viewId);
    if (target) target.classList.add("active");

    document.querySelectorAll(".nav-tab").forEach((el) => el.classList.remove("active"));
    const tab = document.getElementById("tab-" + viewId);
    if (tab) tab.classList.add("active");

    state.activeView = viewId;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  window.navigateTo = function (viewId) {
    showView(viewId);
    if (viewId !== "book-detail") {
      state.lastMainView = viewId;
    }
  };

  window.navigateBack = function () {
    showView(state.lastMainView || "home");
  };

  /* ---------------------------------------------------------------------
   * 3. Google Books API 연동
   * ------------------------------------------------------------------- */
  function normalizeBookItem(item) {
    const info = item.volumeInfo || {};
    const links = info.imageLinks || {};
    let thumbnail = links.thumbnail || links.smallThumbnail || null;
    if (thumbnail) thumbnail = thumbnail.replace(/^http:/, "https:");

    return {
      id: item.id,
      title: info.title || "제목 미상",
      authors: info.authors && info.authors.length ? info.authors.join(", ") : "작가 미상",
      publisher: info.publisher || "",
      publishedDate: info.publishedDate || "",
      description: info.description || "",
      categories: info.categories || [],
      thumbnail: thumbnail,
      averageRating: info.averageRating || null,
      infoLink: info.infoLink || info.canonicalVolumeLink || null,
    };
  }

  /**
   * 단일 페이지 요청 (startIndex 지원)
   */
  async function searchBooksRaw(query, opts = {}) {
    const params = new URLSearchParams({ q: query });
    params.set("maxResults", String(Math.min(opts.maxResults || PAGE_SIZE, 40)));
    params.set("startIndex", String(opts.startIndex || 0));
    if (opts.langRestrict) params.set("langRestrict", opts.langRestrict);
    if (opts.orderBy) params.set("orderBy", opts.orderBy);

    const res = await fetch(`${BOOKS_API}?${params.toString()}`);
    if (!res.ok) throw new Error("Google Books API 요청 실패: " + res.status);
    const data = await res.json();
    const items = (data.items || []).map(normalizeBookItem);
    const totalItems = data.totalItems || 0;
    return { items, totalItems };
  }

  /**
   * 여러 페이지를 병렬로 가져와서 중복 제거 후 합칩니다.
   * @param {string} query
   * @param {{ startPage?: number, pages?: number, langRestrict?: string, orderBy?: string }} opts
   * @returns {{ books: NormalizedBook[], totalItems: number }}
   */
  async function searchBooksMultiPage(query, opts = {}) {
    const startPage = opts.startPage || 0;
    const pages = opts.pages || INITIAL_PAGES;

    const requests = [];
    for (let i = 0; i < pages; i++) {
      const startIndex = (startPage + i) * PAGE_SIZE;
      requests.push(
        searchBooksRaw(query, {
          maxResults: PAGE_SIZE,
          startIndex,
          langRestrict: opts.langRestrict,
          orderBy: opts.orderBy,
        }).catch(() => ({ items: [], totalItems: 0 }))
      );
    }

    const results = await Promise.all(requests);
    const totalItems = results[0]?.totalItems || 0;

    // 중복 제거 (id 기준)
    const seen = new Set();
    const books = [];
    for (const { items } of results) {
      for (const book of items) {
        if (!seen.has(book.id)) {
          seen.add(book.id);
          books.push(book);
        }
      }
    }

    return { books, totalItems };
  }

  async function fetchBookById(id) {
    const res = await fetch(`${BOOKS_API}/${id}`);
    if (!res.ok) throw new Error("도서 정보를 찾을 수 없습니다.");
    const item = await res.json();
    return normalizeBookItem(item);
  }

  /* ---------------------------------------------------------------------
   * 4. 도서 카드 렌더링 (검색 결과 / 추천 결과 공용)
   * ------------------------------------------------------------------- */
  function bookCardHTML(book, opts = {}) {
    const year = book.publishedDate ? book.publishedDate.slice(0, 4) : "";
    const desc = truncate(sanitizeDescription(book.description), 90);
    const safeId = escapeHTML(book.id);

    return `
      <div class="card" style="cursor:pointer; display:flex; flex-direction:column; overflow:hidden; height:100%;" onclick="showBookDetail('${safeId}')">
        <div style="width:100%; height:260px; background-color:var(--color-bg-secondary); display:flex; align-items:center; justify-content:center; overflow:hidden;">
          ${
            book.thumbnail
              ? `<img src="${book.thumbnail}" alt="${escapeHTML(book.title)} 표지" loading="lazy" style="width:100%; height:100%; object-fit:cover;" onerror="this.parentElement.innerHTML='<span style=\\'font-size:36px;\\'>📕</span>'" />`
              : `<span style="font-size:36px;">📕</span>`
          }
        </div>
        <div style="padding:20px; display:flex; flex-direction:column; gap:8px; flex-grow:1;">
          <h4 style="font-size:16px; font-weight:700; line-height:1.4; margin:0; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">${escapeHTML(book.title)}</h4>
          <p style="font-size:13px; color:var(--color-text-secondary); margin:0;">${escapeHTML(book.authors)}${year ? " · " + year : ""}</p>
          <p style="font-size:13px; color:var(--color-text-tertiary); line-height:1.6; margin:0; flex-grow:1;">${escapeHTML(desc) || "도서 소개가 준비중입니다."}</p>
          ${
            opts.aiReason
              ? `<div style="margin-top:6px; padding:12px 14px; background-color:var(--color-bg-secondary); border-left:3px solid var(--color-gold); font-size:13px; font-style:italic; color:var(--color-text-primary); line-height:1.6;">${escapeHTML(opts.aiReason)}</div>`
              : ""
          }
        </div>
      </div>`;
  }

  /* ---------------------------------------------------------------------
   * 5. 도서 검색 (홈 검색바 + 검색 화면)
   * ------------------------------------------------------------------- */
  function setEmptyStateText(line1, line2) {
    const empty = document.getElementById("search-empty-state");
    if (!empty) return;
    const ps = empty.querySelectorAll("p");
    if (ps[0]) ps[0].textContent = line1;
    if (ps[1]) ps[1].textContent = line2;
  }

  /**
   * 검색 결과를 그리드에 렌더링합니다.
   * @param {object[]} books        - 이번에 추가할 도서 목록
   * @param {string}   query        - 검색어 (요약 문구에 사용)
   * @param {number}   totalItems   - API가 보고한 전체 결과 수
   * @param {boolean}  append       - true면 기존 결과에 이어붙임, false면 초기화
   */
  function renderSearchResults(books, query, totalItems, append) {
    const grid = document.getElementById("search-results-grid");
    const summary = document.getElementById("search-results-summary");
    const empty = document.getElementById("search-empty-state");
    const loadMoreWrapper = document.getElementById("search-load-more-wrapper");

    if (!books.length && !append) {
      grid.innerHTML = "";
      summary.style.display = "none";
      setEmptyStateText("해당 도서를 서재에서 찾지 못했습니다.", "다른 키워드로 검색해 보세요.");
      empty.style.display = "block";
      if (loadMoreWrapper) loadMoreWrapper.style.display = "none";
      return;
    }

    empty.style.display = "none";
    summary.style.display = "block";

    if (append) {
      grid.insertAdjacentHTML("beforeend", books.map((b) => bookCardHTML(b)).join(""));
    } else {
      grid.innerHTML = books.map((b) => bookCardHTML(b)).join("");
    }

    // 현재 화면에 표시된 카드 수
    const shownCount = grid.querySelectorAll(".card").length;
    summary.textContent = `'${query}'에 대한 검색 결과 ${shownCount}건 (전체 약 ${totalItems.toLocaleString()}건)`;

    // "더 불러오기" 버튼 표시 여부 결정
    // 다음 페이지 시작 인덱스가 totalItems보다 작으면 더 가져올 수 있음
    const nextStartIndex = state.currentPage * PAGE_SIZE;
    state.hasMoreResults = nextStartIndex < totalItems && nextStartIndex < 500; // API 실질 한계 ~500

    if (loadMoreWrapper) {
      loadMoreWrapper.style.display = state.hasMoreResults ? "flex" : "none";
    }
  }

  function renderSearchError() {
    const grid = document.getElementById("search-results-grid");
    const summary = document.getElementById("search-results-summary");
    const empty = document.getElementById("search-empty-state");
    const loadMoreWrapper = document.getElementById("search-load-more-wrapper");
    grid.innerHTML = "";
    summary.style.display = "none";
    setEmptyStateText("도서 정보를 불러오는 중 문제가 발생했습니다.", "잠시 후 다시 시도해 주세요.");
    empty.style.display = "block";
    if (loadMoreWrapper) loadMoreWrapper.style.display = "none";
  }

  /**
   * 검색 쿼리를 API용 q 파라미터로 변환합니다.
   */
  function buildApiQuery(rawQuery, type) {
    switch (type) {
      case "title":  return `intitle:${rawQuery}`;
      case "author": return `inauthor:${rawQuery}`;
      case "genre":  return `subject:${rawQuery}`;
      default:       return rawQuery;
    }
  }

  /**
   * 새로운 검색을 시작합니다 (결과 초기화 후 첫 페이지 로드).
   */
  async function performSearch(rawQuery, type) {
    const query = (rawQuery || "").trim();
    if (!query) {
      notify("검색어를 입력해 주세요.");
      return;
    }

    // 상태 초기화
    state.currentQuery = query;
    state.currentSearchType = type;
    state.currentPage = INITIAL_PAGES;  // 다음 로드는 INITIAL_PAGES 페이지부터
    state.hasMoreResults = false;

    showLoader("도서를 검색하고 있어요...");
    try {
      const apiQuery = buildApiQuery(query, type);
      const { books, totalItems } = await searchBooksMultiPage(apiQuery, {
        startPage: 0,
        pages: INITIAL_PAGES,
      });
      books.forEach((b) => (state.booksCache[b.id] = b));
      renderSearchResults(books, query, totalItems, false);
    } catch (err) {
      console.error(err);
      renderSearchError();
    } finally {
      hideLoader();
    }
  }

  /**
   * "더 불러오기" 버튼 클릭 시 다음 페이지들을 추가로 가져옵니다.
   * index.html의 "더 불러오기" 버튼에서 onclick="loadMoreResults()" 로 호출.
   */
  window.loadMoreResults = async function () {
    if (state.isLoadingMore || !state.hasMoreResults) return;
    state.isLoadingMore = true;

    const btn = document.getElementById("search-load-more-btn");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "불러오는 중...";
    }

    try {
      const apiQuery = buildApiQuery(state.currentQuery, state.currentSearchType);
      const { books, totalItems } = await searchBooksMultiPage(apiQuery, {
        startPage: state.currentPage,
        pages: LOAD_MORE_PAGES,
      });

      // 이미 캐시에 있는 (= 이미 표시된) 책 제외
      const newBooks = books.filter((b) => {
        if (state.booksCache[b.id]) return false;
        state.booksCache[b.id] = b;
        return true;
      });

      state.currentPage += LOAD_MORE_PAGES;

      if (newBooks.length) {
        renderSearchResults(newBooks, state.currentQuery, totalItems, true);
      } else {
        // 새 책이 없으면 더 이상 없음으로 처리
        state.hasMoreResults = false;
        const loadMoreWrapper = document.getElementById("search-load-more-wrapper");
        if (loadMoreWrapper) loadMoreWrapper.style.display = "none";
        notify("더 이상 불러올 도서가 없습니다.");
      }
    } catch (err) {
      console.error(err);
      notify("추가 도서를 불러오는 중 문제가 발생했습니다.");
    } finally {
      state.isLoadingMore = false;
      if (btn) {
        btn.disabled = false;
        btn.textContent = "더 불러오기";
      }
    }
  };

  // index.html 검색 화면 폼: onsubmit="handleSearch(event)"
  window.handleSearch = function (event) {
    event.preventDefault();
    const type = document.getElementById("search-type").value;
    const query = document.getElementById("search-input").value;
    performSearch(query, type);
  };

  // index.html 홈 화면 검색바 폼: onsubmit="handleHomeSearch(event)"
  window.handleHomeSearch = function (event) {
    event.preventDefault();
    const query = document.getElementById("home-search-input").value.trim();
    if (!query) {
      notify("검색어를 입력해 주세요.");
      return;
    }
    navigateTo("search");
    const searchInput = document.getElementById("search-input");
    const searchType = document.getElementById("search-type");
    if (searchInput) searchInput.value = query;
    if (searchType) searchType.value = "all";
    performSearch(query, "all");
  };

  /* ---------------------------------------------------------------------
   * 6. AI 맞춤 책 추천
   * ------------------------------------------------------------------- */
  window.toggleGenreSelection = function (btn, genre) {
    if (state.selectedGenres.has(genre)) {
      state.selectedGenres.delete(genre);
      btn.classList.remove("selected");
      btn.style.backgroundColor = "";
      btn.style.color = "";
      btn.style.borderColor = "";
      btn.style.fontWeight = "";
    } else {
      state.selectedGenres.add(genre);
      btn.classList.add("selected");
      btn.style.backgroundColor = "var(--color-gold)";
      btn.style.color = "var(--color-white)";
      btn.style.borderColor = "var(--color-gold)";
      btn.style.fontWeight = "700";
    }
  };

  async function fetchRecommendationCandidates(genres, keywords) {
    const queries = [];
    if (genres.length) {
      genres.forEach((g) => queries.push(keywords ? `${g} ${keywords}` : g));
    } else if (keywords) {
      queries.push(keywords);
    } else {
      queries.push("추천 도서");
    }

    const resultsArrays = await Promise.all(
      queries.map((q) =>
        searchBooksRaw(q, { maxResults: 40, startIndex: 0, langRestrict: "ko" }).catch(() => ({
          items: [],
          totalItems: 0,
        }))
      )
    );

    const all = {};
    const withThumb = {};
    resultsArrays.forEach(({ items }) => {
      items.forEach((b) => {
        all[b.id] = b;
        if (b.thumbnail) withThumb[b.id] = b;
      });
    });

    const pool = Object.values(withThumb);
    return pool.length >= 5 ? pool : Object.values(all);
  }

  function craftReason(book, style, keywords, index) {
    const templates = [
      () => `"${style}"를 찾는 마음에, 「${book.title}」가 차분히 다가와 그 결을 채워줄 책입니다.`,
      () => `「${book.title}」은 ${keywords ? `'${truncate(keywords, 24)}'라는 마음` : "지금 이 순간의 마음"}에 또 하나의 결을 더해줄 한 권입니다.`,
      () => `한 장씩 넘길 때마다, 「${book.title}」은 ${style}에 가장 가까운 결을 지닌 책으로 다가올 것입니다.`,
      () => `지금 머무는 생각의 결을 따라가 보면, 「${book.title}」만큼 어울리는 책을 찾기 어려울 것입니다.`,
      () => `${book.categories.length ? book.categories[0] + " 서가에서, " : ""}「${book.title}」은 오늘의 당신에게 조용히 건네는 한 권의 위안입니다.`,
    ];
    return templates[index % templates.length]();
  }

  window.handleRecommendation = async function (event) {
    event.preventDefault();
    const genres = Array.from(state.selectedGenres);
    const keywords = document.getElementById("recommend-keywords").value.trim();
    const style = document.getElementById("recommend-style").value;

    if (!genres.length && !keywords) {
      notify("선호 장르를 선택하거나, 마음에 머무는 키워드를 입력해 주세요.");
      return;
    }

    showLoader("당신의 결을 닮은 책을 고르고 있어요...");
    try {
      const candidates = await fetchRecommendationCandidates(genres, keywords);
      if (!candidates.length) {
        notify("조건에 맞는 도서를 찾지 못했습니다. 다른 키워드로 시도해 보세요.");
        return;
      }
      shuffle(candidates);
      const picks = candidates.slice(0, 5);
      picks.forEach((b) => (state.booksCache[b.id] = b));

      const grid = document.getElementById("recommend-grid");
      grid.innerHTML = picks
        .map((b, i) => bookCardHTML(b, { aiReason: craftReason(b, style, keywords, i) }))
        .join("");

      document.getElementById("recommend-form-wrapper").style.display = "none";
      document.getElementById("recommend-results-wrapper").style.display = "block";
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      console.error(err);
      notify("추천 도서를 불러오는 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      hideLoader();
    }
  };

  window.resetRecommendations = function () {
    document.getElementById("recommend-results-wrapper").style.display = "none";
    document.getElementById("recommend-form-wrapper").style.display = "block";
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /* ---------------------------------------------------------------------
   * 7. 도서 상세보기
   * ------------------------------------------------------------------- */
  function renderBookDetail(book) {
    const card = document.getElementById("book-detail-card");
    const categories = book.categories.length ? book.categories.join(", ") : "";
    const year = book.publishedDate ? book.publishedDate.slice(0, 4) : "";

    card.innerHTML = `
      <div style="background-color:var(--color-bg-secondary); border:1px solid var(--color-border); display:flex; align-items:center; justify-content:center; min-height:380px; overflow:hidden;">
        ${
          book.thumbnail
            ? `<img src="${book.thumbnail}" alt="${escapeHTML(book.title)} 표지" style="width:100%; height:100%; object-fit:cover;" />`
            : `<span style="font-size:64px;">📕</span>`
        }
      </div>
      <div>
        ${categories ? `<p style="font-size:12px; letter-spacing:.1em; color:var(--color-gold-dark); text-transform:uppercase; font-weight:700; margin-bottom:10px;">${escapeHTML(categories)}</p>` : ""}
        <h1 style="font-size:30px; font-weight:800; line-height:1.3; margin-bottom:10px;">${escapeHTML(book.title)}</h1>
        <p style="font-size:16px; color:var(--color-text-secondary); margin-bottom:18px;">${escapeHTML(book.authors)}${book.publisher ? " · " + escapeHTML(book.publisher) : ""}${year ? " · " + year : ""}</p>
        <div class="gold-decor left" style="width:40px; margin:0 0 18px;"></div>
        <p style="font-size:15px; line-height:1.9; color:var(--color-text-primary); white-space:pre-line;">${book.description ? escapeHTML(sanitizeDescription(book.description)) : "등록된 책 소개가 없습니다."}</p>
        ${book.infoLink ? `<a href="${book.infoLink}" target="_blank" rel="noopener" class="btn btn-secondary" style="margin-top:24px; display:inline-block;">Google Books에서 자세히 보기 ↗</a>` : ""}
      </div>`;
  }

  window.showBookDetail = async function (id) {
    state.currentDetailBookId = id;
    showView("book-detail");
    showLoader("도서 정보를 불러오고 있어요...");
    try {
      let book = state.booksCache[id];
      if (!book) {
        book = await fetchBookById(id);
        state.booksCache[id] = book;
      }
      renderBookDetail(book);
      renderReviewSection(id);
    } catch (err) {
      console.error(err);
      document.getElementById("book-detail-card").innerHTML =
        `<p style="grid-column:1 / -1; text-align:center; padding:40px 0; color:var(--color-text-secondary);">도서 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>`;
    } finally {
      hideLoader();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  /* ---------------------------------------------------------------------
   * 8. 평점 및 리뷰 (localStorage 기반)
   * ------------------------------------------------------------------- */
  function loadAllReviews() {
    try {
      return JSON.parse(localStorage.getItem(REVIEWS_KEY)) || {};
    } catch (e) {
      return {};
    }
  }

  function saveAllReviews(data) {
    localStorage.setItem(REVIEWS_KEY, JSON.stringify(data));
  }

  function getReviewsForBook(bookId) {
    return loadAllReviews()[bookId] || [];
  }

  function setReviewsForBook(bookId, reviews) {
    const all = loadAllReviews();
    all[bookId] = reviews;
    saveAllReviews(all);
  }

  function starsDisplayHTML(avg) {
    const rounded = Math.round(avg);
    let html = "";
    for (let i = 1; i <= 5; i++) {
      html += `<span style="color:${i <= rounded ? "var(--color-gold)" : "var(--color-border)"}; font-size:18px;">★</span>`;
    }
    return html;
  }

  function starPickerHTML(n) {
    let html = "";
    for (let i = 1; i <= 5; i++) {
      html += `<span onclick="setPendingRating(${i})" style="cursor:pointer; font-size:26px; line-height:1; margin-right:4px; color:${i <= n ? "var(--color-gold)" : "var(--color-border)"};">★</span>`;
    }
    return html;
  }

  window.setPendingRating = function (n) {
    state.pendingRating = n;
    const el = document.getElementById("review-star-picker");
    if (el) el.innerHTML = starPickerHTML(n);
  };

  function reviewFormHTML(bookId) {
    const editing = state.editingReviewId;
    let prefillText = "";
    if (editing) {
      const found = getReviewsForBook(bookId).find((r) => r.id === editing);
      if (found) {
        prefillText = found.comment;
        state.pendingRating = found.rating;
      } else {
        state.editingReviewId = null;
        state.pendingRating = 0;
      }
    } else {
      state.pendingRating = 0;
    }

    return `
      <div class="card" style="padding:28px; background-color:var(--color-bg-secondary); border:1px solid var(--color-border);">
        <h4 style="font-size:16px; font-weight:700; margin-bottom:16px;">${editing ? "리뷰 수정하기" : "리뷰 작성하기"}</h4>
        <div id="review-star-picker" style="margin-bottom:14px;">${starPickerHTML(state.pendingRating)}</div>
        <textarea id="review-comment-input" class="form-control" rows="3" placeholder="이 책에 대한 감상을 한 줄, 혹은 몇 줄로 남겨주세요." style="resize:none; margin-bottom:14px; background-color:var(--color-white); line-height:1.7;">${escapeHTML(prefillText)}</textarea>
        <div style="display:flex; gap:10px;">
          <button type="button" class="btn btn-primary" style="padding:10px 24px;" onclick="submitReview('${escapeHTML(bookId)}')">${editing ? "수정 완료" : "리뷰 등록"}</button>
          ${editing ? `<button type="button" class="btn btn-secondary" style="padding:10px 24px;" onclick="cancelEditReview('${escapeHTML(bookId)}')">취소</button>` : ""}
        </div>
      </div>`;
  }

  function reviewCardHTML(review, bookId) {
    const dateStr = new Date(review.updatedAt || review.createdAt).toLocaleDateString("ko-KR");
    return `
      <div class="card" style="padding:24px; display:flex; flex-direction:column; gap:10px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px;">
          <div class="star-rating" style="color:var(--color-gold); font-size:15px; letter-spacing:1px;">${"★".repeat(review.rating)}${"☆".repeat(5 - review.rating)}</div>
          <span style="font-size:12px; color:var(--color-text-tertiary); white-space:nowrap;">${dateStr}${review.updatedAt ? " (수정됨)" : ""}</span>
        </div>
        <p style="font-size:14px; line-height:1.8; color:var(--color-text-primary); white-space:pre-line; margin:0;">${escapeHTML(review.comment)}</p>
        <div style="display:flex; gap:8px; margin-top:6px;">
          <button class="btn btn-secondary" style="padding:6px 14px; font-size:12px;" onclick="startEditReview('${escapeHTML(bookId)}','${escapeHTML(review.id)}')">수정</button>
          <button class="btn btn-secondary" style="padding:6px 14px; font-size:12px;" onclick="deleteReview('${escapeHTML(bookId)}','${escapeHTML(review.id)}')">삭제</button>
        </div>
      </div>`;
  }

  function renderReviewSection(bookId) {
    const reviews = getReviewsForBook(bookId)
      .slice()
      .sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));
    const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

    document.getElementById("detail-avg-rating").textContent = avg.toFixed(1);
    document.getElementById("detail-avg-stars").innerHTML = starsDisplayHTML(avg);
    document.getElementById("detail-review-count").textContent = `전체 리뷰 ${reviews.length}개`;
    document.getElementById("write-review-block").innerHTML = reviewFormHTML(bookId);

    const list = document.getElementById("reviews-list-container");
    if (!reviews.length) {
      list.innerHTML = `<p style="text-align:center; padding:40px 0; color:var(--color-text-tertiary); background-color:var(--color-white); border:1px solid var(--color-border);">가장 먼저 이 책에 대한 감상을 남겨보세요.</p>`;
    } else {
      list.innerHTML = reviews.map((r) => reviewCardHTML(r, bookId)).join("");
    }
  }

  window.submitReview = function (bookId) {
    const rating = state.pendingRating;
    const commentEl = document.getElementById("review-comment-input");
    const comment = commentEl ? commentEl.value.trim() : "";

    if (!rating) {
      notify("별점을 선택해 주세요.");
      return;
    }
    if (!comment) {
      notify("감상평을 입력해 주세요.");
      return;
    }

    let reviews = getReviewsForBook(bookId);
    if (state.editingReviewId) {
      reviews = reviews.map((r) =>
        r.id === state.editingReviewId ? { ...r, rating, comment, updatedAt: Date.now() } : r
      );
      state.editingReviewId = null;
    } else {
      reviews.push({
        id: "rv_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
        rating,
        comment,
        createdAt: Date.now(),
      });
    }
    setReviewsForBook(bookId, reviews);
    state.pendingRating = 0;
    renderReviewSection(bookId);
    notify("리뷰가 저장되었습니다.");
  };

  window.startEditReview = function (bookId, reviewId) {
    state.editingReviewId = reviewId;
    renderReviewSection(bookId);
    const block = document.getElementById("write-review-block");
    if (block) block.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  window.cancelEditReview = function (bookId) {
    state.editingReviewId = null;
    state.pendingRating = 0;
    renderReviewSection(bookId);
  };

  window.deleteReview = function (bookId, reviewId) {
    if (!confirm("이 리뷰를 삭제하시겠습니까?")) return;
    const reviews = getReviewsForBook(bookId).filter((r) => r.id !== reviewId);
    setReviewsForBook(bookId, reviews);
    if (state.editingReviewId === reviewId) state.editingReviewId = null;
    renderReviewSection(bookId);
    notify("리뷰가 삭제되었습니다.");
  };

  /* ---------------------------------------------------------------------
   * 9. 초기화
   * ------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", function () {
    navigateTo("home");
  });
})();
