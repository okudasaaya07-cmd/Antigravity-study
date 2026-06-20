/* ==========================================================================
   La Librairie — app.js
   Google Books API를 활용한 클라이언트 사이드 도서 검색 / AI 맞춤 추천 /
   상세보기 / 리뷰(평점) 기능을 제공합니다.

   ★ API 키 설정 방법 ★
   아래 GOOGLE_API_KEY 에 Google Books API 키를 넣으면 훨씬 안정적입니다.
   (무료 키 발급: https://console.cloud.google.com → Books API 사용 설정)
   키가 없어도 동작하지만, 잦은 검색 시 일시 차단될 수 있습니다.
   ========================================================================== */

(function () {
  "use strict";

  /* ▼ 여기에 Google Books API 키를 입력하세요 (없으면 빈 문자열 "") */
  var GOOGLE_API_KEY = "";

  /* -------------------------------------------------------------------------
   * 0. 전역 상태
   * ----------------------------------------------------------------------- */
  var state = {
    activeView: "home",
    lastMainView: "home",
    selectedGenres: new Set(),
    booksCache: {},
    currentDetailBookId: null,
    editingReviewId: null,
    pendingRating: 0,
    currentApiQuery: "",
    currentRawQuery: "",
    currentPage: 1,
    totalItems: 0,
    isLoadingMore: false,
  };

  var REVIEWS_KEY = "laLibrairieReviews_v1";
  var BOOKS_API   = "https://www.googleapis.com/books/v1/volumes";
  var PAGE_SIZE   = 40;

  /* -------------------------------------------------------------------------
   * 1. 공통 유틸
   * ----------------------------------------------------------------------- */
  function escapeHTML(str) {
    if (str == null) return "";
    return String(str)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
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
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr;
  }

  function sleep(ms) {
    return new Promise(function(r) { setTimeout(r, ms); });
  }

  function el(id) { return document.getElementById(id); }

  function showLoader(message) {
    var loader = el("global-loader");
    var msgEl  = el("loader-message");
    if (msgEl)  msgEl.textContent = message || "불러오는 중입니다...";
    if (loader) loader.style.display = "flex";
  }

  function hideLoader() {
    var loader = el("global-loader");
    if (loader) loader.style.display = "none";
  }

  function notify(message) {
    var toast = el("app-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "app-toast";
      Object.assign(toast.style, {
        position:"fixed", bottom:"32px", left:"50%",
        transform:"translateX(-50%)",
        backgroundColor:"var(--color-text-primary)", color:"var(--color-white)",
        padding:"14px 28px", borderRadius:"3px", fontSize:"14px",
        zIndex:"2000", boxShadow:"var(--shadow-subtle)",
        opacity:"0", transition:"opacity .3s",
        maxWidth:"90vw", textAlign:"center",
      });
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.opacity = "1";
    clearTimeout(window.__appToastTimer);
    window.__appToastTimer = setTimeout(function() {
      toast.style.opacity = "0";
    }, 2800);
  }

  /* -------------------------------------------------------------------------
   * 2. 화면 전환
   * ----------------------------------------------------------------------- */
  function showView(viewId) {
    document.querySelectorAll(".view-section").forEach(function(e) {
      e.classList.remove("active");
    });
    var target = el("view-" + viewId);
    if (target) target.classList.add("active");

    document.querySelectorAll(".nav-tab").forEach(function(e) {
      e.classList.remove("active");
    });
    var tab = el("tab-" + viewId);
    if (tab) tab.classList.add("active");

    state.activeView = viewId;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  window.navigateTo = function(viewId) {
    showView(viewId);
    if (viewId !== "book-detail") state.lastMainView = viewId;
  };

  window.navigateBack = function() {
    showView(state.lastMainView || "home");
  };

  /* -------------------------------------------------------------------------
   * 3. Google Books API
   * ----------------------------------------------------------------------- */
  function normalizeBookItem(item) {
    var info  = item.volumeInfo || {};
    var links = info.imageLinks  || {};
    var thumbnail = links.thumbnail || links.smallThumbnail || null;
    if (thumbnail) thumbnail = thumbnail.replace(/^http:/, "https:");
    return {
      id:            item.id,
      title:         info.title         || "제목 미상",
      authors:       (info.authors && info.authors.length) ? info.authors.join(", ") : "작가 미상",
      publisher:     info.publisher     || "",
      publishedDate: info.publishedDate || "",
      description:   info.description   || "",
      categories:    info.categories    || [],
      thumbnail:     thumbnail,
      averageRating: info.averageRating || null,
      infoLink:      info.infoLink || info.canonicalVolumeLink || null,
    };
  }

  /**
   * 단일 페이지 요청. { items, totalItems } 반환.
   */
  function searchBooksRaw(query, opts) {
    opts = opts || {};
    var params = new URLSearchParams({ q: query });
    params.set("maxResults", String(Math.min(opts.maxResults || PAGE_SIZE, 40)));
    params.set("startIndex", String(opts.startIndex || 0));
    if (opts.langRestrict) params.set("langRestrict", opts.langRestrict);
    if (opts.orderBy)      params.set("orderBy",      opts.orderBy);
    if (GOOGLE_API_KEY)    params.set("key",          GOOGLE_API_KEY);

    return fetch(BOOKS_API + "?" + params.toString())
      .then(function(res) {
        if (!res.ok) {
          return res.text().then(function(body) {
            throw new Error("API " + res.status + ": " + body.slice(0, 100));
          });
        }
        return res.json();
      })
      .then(function(data) {
        return {
          items:      (data.items || []).map(normalizeBookItem),
          totalItems: data.totalItems || 0,
        };
      });
  }

  /** 실패해도 빈 결과를 반환하는 안전한 버전 */
  function searchBooksRawSafe(query, opts) {
    return searchBooksRaw(query, opts).catch(function() {
      return { items: [], totalItems: 0 };
    });
  }

  function fetchBookById(id) {
    var url = BOOKS_API + "/" + id + (GOOGLE_API_KEY ? "?key=" + GOOGLE_API_KEY : "");
    return fetch(url).then(function(res) {
      if (!res.ok) throw new Error("도서 정보를 찾을 수 없습니다.");
      return res.json();
    }).then(normalizeBookItem);
  }

  /* -------------------------------------------------------------------------
   * 4. 도서 카드 HTML
   * ----------------------------------------------------------------------- */
  function bookCardHTML(book, opts) {
    opts = opts || {};
    var year   = book.publishedDate ? book.publishedDate.slice(0, 4) : "";
    var desc   = truncate(sanitizeDescription(book.description), 90);
    var safeId = escapeHTML(book.id);
    return (
      '<div class="card" style="cursor:pointer;display:flex;flex-direction:column;overflow:hidden;height:100%;" onclick="showBookDetail(\'' + safeId + '\')">' +
        '<div style="width:100%;height:260px;background-color:var(--color-bg-secondary);display:flex;align-items:center;justify-content:center;overflow:hidden;">' +
          (book.thumbnail
            ? '<img src="' + book.thumbnail + '" alt="' + escapeHTML(book.title) + ' 표지" loading="lazy" style="width:100%;height:100%;object-fit:cover;" onerror="this.parentElement.innerHTML=\'<span style=\\\'font-size:36px;\\\'>📕</span>\'">'
            : '<span style="font-size:36px;">📕</span>') +
        '</div>' +
        '<div style="padding:20px;display:flex;flex-direction:column;gap:8px;flex-grow:1;">' +
          '<h4 style="font-size:16px;font-weight:700;line-height:1.4;margin:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">' + escapeHTML(book.title) + '</h4>' +
          '<p style="font-size:13px;color:var(--color-text-secondary);margin:0;">' + escapeHTML(book.authors) + (year ? " · " + year : "") + '</p>' +
          '<p style="font-size:13px;color:var(--color-text-tertiary);line-height:1.6;margin:0;flex-grow:1;">' + (escapeHTML(desc) || "도서 소개가 준비중입니다.") + '</p>' +
          (opts.aiReason
            ? '<div style="margin-top:6px;padding:12px 14px;background-color:var(--color-bg-secondary);border-left:3px solid var(--color-gold);font-size:13px;font-style:italic;color:var(--color-text-primary);line-height:1.6;">' + escapeHTML(opts.aiReason) + '</div>'
            : '') +
        '</div>' +
      '</div>'
    );
  }

  /* -------------------------------------------------------------------------
   * 5. 검색 결과 렌더링
   * ----------------------------------------------------------------------- */
  function updateSummary() {
    var grid    = el("search-results-grid");
    var summary = el("search-results-summary");
    if (!grid || !summary) return;
    var shownCount = grid.querySelectorAll(".card").length;
    var totalStr   = state.totalItems > 0
      ? " (전체 약 " + state.totalItems.toLocaleString() + "건)"
      : "";
    summary.textContent = "'" + state.currentRawQuery + "'에 대한 검색 결과 " + shownCount + "건" + totalStr;
  }

  function updateLoadMoreBtn() {
    var wrapper = el("search-load-more-wrapper");
    if (!wrapper) return;
    var nextIdx = state.currentPage * PAGE_SIZE;
    var hasMore = state.totalItems > 0 && nextIdx < state.totalItems && nextIdx < 480;
    wrapper.style.display = hasMore ? "flex" : "none";
  }

  function appendSearchResults(books, append) {
    var grid    = el("search-results-grid");
    var summary = el("search-results-summary");
    var empty   = el("search-empty-state");
    if (!grid) return;

    if (!books.length && !append) {
      grid.innerHTML = "";
      if (summary) summary.style.display = "none";
      if (empty) {
        var ps = empty.querySelectorAll("p");
        if (ps[0]) ps[0].textContent = "해당 도서를 서재에서 찾지 못했습니다.";
        if (ps[1]) ps[1].textContent = "다른 키워드로 검색해 보세요.";
        empty.style.display = "block";
      }
      updateLoadMoreBtn();
      return;
    }

    if (empty)   empty.style.display = "none";
    if (summary) summary.style.display = "block";

    var html = books.map(function(b) { return bookCardHTML(b); }).join("");
    if (append) {
      grid.insertAdjacentHTML("beforeend", html);
    } else {
      grid.innerHTML = html;
    }

    updateSummary();
    updateLoadMoreBtn();
  }

  /* -------------------------------------------------------------------------
   * 6. 도서 검색
   * ----------------------------------------------------------------------- */
  function buildApiQuery(rawQuery, type) {
    var q = (rawQuery || "").trim();
    if (type === "title")  return "intitle:" + q;
    if (type === "author") return "inauthor:" + q;
    if (type === "genre")  return "subject:" + q;
    return q;
  }

  /**
   * 새 검색 시작:
   *  1) 첫 40권 즉시 표시
   *  2) 2·3페이지(+80권) 순차 추가
   *  첫 요청 실패 시 prefix 없는 단순 쿼리로 재시도
   */
  function performSearch(rawQuery, type) {
    var query = (rawQuery || "").trim();
    if (!query) { notify("검색어를 입력해 주세요."); return; }

    state.currentRawQuery = query;
    state.currentApiQuery = buildApiQuery(query, type);
    state.currentPage     = 1;
    state.totalItems      = 0;

    showLoader("도서를 검색하고 있어요...");

    /* ── 1차 시도 ── */
    var firstPromise = searchBooksRaw(state.currentApiQuery, { startIndex: 0, maxResults: PAGE_SIZE })
      .catch(function(err) {
        /* 실패 시 단순 쿼리로 재시도 */
        console.warn("1차 쿼리 실패, 단순 쿼리로 재시도:", err.message);
        state.currentApiQuery = query;
        return searchBooksRaw(query, { startIndex: 0, maxResults: PAGE_SIZE });
      });

    firstPromise.then(function(firstResult) {
      state.totalItems  = firstResult.totalItems;
      state.currentPage = 1;

      firstResult.items.forEach(function(b) { state.booksCache[b.id] = b; });
      appendSearchResults(firstResult.items, false);
      hideLoader();

      if (!firstResult.items.length) return;

      /* ── 2·3페이지 순차 추가 ── */
      function loadPage(page) {
        if (page > 2) return;
        var startIndex = page * PAGE_SIZE;
        if (startIndex >= state.totalItems || startIndex >= 480) return;

        sleep(400).then(function() {
          return searchBooksRawSafe(state.currentApiQuery, { startIndex: startIndex, maxResults: PAGE_SIZE });
        }).then(function(extra) {
          var newBooks = extra.items.filter(function(b) {
            if (state.booksCache[b.id]) return false;
            state.booksCache[b.id] = b;
            return true;
          });
          if (newBooks.length) {
            state.currentPage = page + 1;
            appendSearchResults(newBooks, true);
          }
          loadPage(page + 1);
        });
      }
      loadPage(1);

    }).catch(function(err) {
      console.error("검색 오류:", err);
      hideLoader();
      var grid    = el("search-results-grid");
      var summary = el("search-results-summary");
      var empty   = el("search-empty-state");
      var wrapper = el("search-load-more-wrapper");
      if (grid)    grid.innerHTML = "";
      if (summary) summary.style.display = "none";
      if (wrapper) wrapper.style.display = "none";
      if (empty) {
        var ps = empty.querySelectorAll("p");
        if (ps[0]) ps[0].textContent = "도서 정보를 불러오는 중 문제가 발생했습니다.";
        if (ps[1]) ps[1].textContent = "네트워크를 확인하거나 잠시 후 다시 시도해 주세요.";
        empty.style.display = "block";
      }
    });
  }

  /**
   * "더 불러오기" 버튼
   * index.html: <button id="search-load-more-btn" onclick="loadMoreResults()">더 불러오기</button>
   */
  window.loadMoreResults = function() {
    if (state.isLoadingMore) return;
    var nextStartIndex = state.currentPage * PAGE_SIZE;
    if (nextStartIndex >= state.totalItems || nextStartIndex >= 480) return;

    state.isLoadingMore = true;
    var btn = el("search-load-more-btn");
    if (btn) { btn.disabled = true; btn.textContent = "불러오는 중..."; }

    function loadPage(i) {
      if (i >= 2) {
        state.isLoadingMore = false;
        if (btn) { btn.disabled = false; btn.textContent = "더 불러오기"; }
        state.currentPage += 2;
        updateLoadMoreBtn();
        return;
      }
      var startIndex = (state.currentPage + i) * PAGE_SIZE;
      if (startIndex >= state.totalItems || startIndex >= 480) {
        loadPage(2); return; // 종료
      }
      var wait = i === 0 ? Promise.resolve() : sleep(400);
      wait.then(function() {
        return searchBooksRawSafe(state.currentApiQuery, { startIndex: startIndex, maxResults: PAGE_SIZE });
      }).then(function(extra) {
        var newBooks = extra.items.filter(function(b) {
          if (state.booksCache[b.id]) return false;
          state.booksCache[b.id] = b;
          return true;
        });
        if (newBooks.length) appendSearchResults(newBooks, true);
        loadPage(i + 1);
      });
    }
    loadPage(0);
  };

  /* index.html 검색 화면: onsubmit="handleSearch(event)" */
  window.handleSearch = function(event) {
    event.preventDefault();
    var type  = el("search-type")  ? el("search-type").value  : "all";
    var query = el("search-input") ? el("search-input").value : "";
    performSearch(query, type);
  };

  /* index.html 홈 검색바: onsubmit="handleHomeSearch(event)" */
  window.handleHomeSearch = function(event) {
    event.preventDefault();
    var query = el("home-search-input") ? el("home-search-input").value.trim() : "";
    if (!query) { notify("검색어를 입력해 주세요."); return; }
    window.navigateTo("search");
    var searchInput = el("search-input");
    var searchType  = el("search-type");
    if (searchInput) searchInput.value = query;
    if (searchType)  searchType.value  = "all";
    performSearch(query, "all");
  };

  /* -------------------------------------------------------------------------
   * 7. AI 맞춤 책 추천
   * ----------------------------------------------------------------------- */
  window.toggleGenreSelection = function(btn, genre) {
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

  function fetchRecommendationCandidates(genres, keywords) {
    var queries = [];
    if (genres.length) {
      genres.forEach(function(g) { queries.push(keywords ? g + " " + keywords : g); });
    } else if (keywords) {
      queries.push(keywords);
    } else {
      queries.push("추천 도서");
    }

    var all = {}, withThumb = {};

    function next(i) {
      if (i >= queries.length) {
        var pool = Object.values(withThumb);
        return Promise.resolve(pool.length >= 5 ? pool : Object.values(all));
      }
      return sleep(i === 0 ? 0 : 300).then(function() {
        return searchBooksRawSafe(queries[i], { maxResults: 40, startIndex: 0, langRestrict: "ko" });
      }).then(function(result) {
        result.items.forEach(function(b) {
          all[b.id] = b;
          if (b.thumbnail) withThumb[b.id] = b;
        });
        return next(i + 1);
      });
    }

    return next(0);
  }

  function craftReason(book, style, keywords, index) {
    var templates = [
      function() { return '"' + style + '"를 찾는 마음에, 「' + book.title + '」가 차분히 다가와 그 결을 채워줄 책입니다.'; },
      function() { return '「' + book.title + '」은 ' + (keywords ? "'" + truncate(keywords, 24) + "'라는 마음" : "지금 이 순간의 마음") + '에 또 하나의 결을 더해줄 한 권입니다.'; },
      function() { return '한 장씩 넘길 때마다, 「' + book.title + '」은 ' + style + '에 가장 가까운 결을 지닌 책으로 다가올 것입니다.'; },
      function() { return '지금 머무는 생각의 결을 따라가 보면, 「' + book.title + '」만큼 어울리는 책을 찾기 어려울 것입니다.'; },
      function() { return (book.categories.length ? book.categories[0] + " 서가에서, " : "") + '「' + book.title + '」은 오늘의 당신에게 조용히 건네는 한 권의 위안입니다.'; },
    ];
    return templates[index % templates.length]();
  }

  window.handleRecommendation = function(event) {
    event.preventDefault();
    var genres   = Array.from(state.selectedGenres);
    var keywords = el("recommend-keywords") ? el("recommend-keywords").value.trim() : "";
    var style    = el("recommend-style")    ? el("recommend-style").value            : "";

    if (!genres.length && !keywords) {
      notify("선호 장르를 선택하거나, 마음에 머무는 키워드를 입력해 주세요.");
      return;
    }

    showLoader("당신의 결을 닮은 책을 고르고 있어요...");
    fetchRecommendationCandidates(genres, keywords).then(function(candidates) {
      if (!candidates.length) {
        notify("조건에 맞는 도서를 찾지 못했습니다. 다른 키워드로 시도해 보세요.");
        return;
      }
      shuffle(candidates);
      var picks = candidates.slice(0, 5);
      picks.forEach(function(b) { state.booksCache[b.id] = b; });

      var grid = el("recommend-grid");
      if (grid) {
        grid.innerHTML = picks.map(function(b, i) {
          return bookCardHTML(b, { aiReason: craftReason(b, style, keywords, i) });
        }).join("");
      }

      var formW    = el("recommend-form-wrapper");
      var resultsW = el("recommend-results-wrapper");
      if (formW)    formW.style.display    = "none";
      if (resultsW) resultsW.style.display = "block";
      window.scrollTo({ top: 0, behavior: "smooth" });
    }).catch(function(err) {
      console.error(err);
      notify("추천 도서를 불러오는 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    }).finally(function() {
      hideLoader();
    });
  };

  window.resetRecommendations = function() {
    var formW    = el("recommend-form-wrapper");
    var resultsW = el("recommend-results-wrapper");
    if (resultsW) resultsW.style.display = "none";
    if (formW)    formW.style.display    = "block";
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /* -------------------------------------------------------------------------
   * 8. 도서 상세보기
   * ----------------------------------------------------------------------- */
  function renderBookDetail(book) {
    var card       = el("book-detail-card");
    if (!card) return;
    var categories = book.categories.length ? book.categories.join(", ") : "";
    var year       = book.publishedDate ? book.publishedDate.slice(0, 4) : "";

    card.innerHTML =
      '<div style="background-color:var(--color-bg-secondary);border:1px solid var(--color-border);display:flex;align-items:center;justify-content:center;min-height:380px;overflow:hidden;">' +
        (book.thumbnail
          ? '<img src="' + book.thumbnail + '" alt="' + escapeHTML(book.title) + ' 표지" style="width:100%;height:100%;object-fit:cover;">'
          : '<span style="font-size:64px;">📕</span>') +
      '</div>' +
      '<div>' +
        (categories ? '<p style="font-size:12px;letter-spacing:.1em;color:var(--color-gold-dark);text-transform:uppercase;font-weight:700;margin-bottom:10px;">' + escapeHTML(categories) + '</p>' : '') +
        '<h1 style="font-size:30px;font-weight:800;line-height:1.3;margin-bottom:10px;">' + escapeHTML(book.title) + '</h1>' +
        '<p style="font-size:16px;color:var(--color-text-secondary);margin-bottom:18px;">' + escapeHTML(book.authors) +
          (book.publisher ? " · " + escapeHTML(book.publisher) : "") + (year ? " · " + year : "") + '</p>' +
        '<div class="gold-decor left" style="width:40px;margin:0 0 18px;"></div>' +
        '<p style="font-size:15px;line-height:1.9;color:var(--color-text-primary);white-space:pre-line;">' +
          (book.description ? escapeHTML(sanitizeDescription(book.description)) : "등록된 책 소개가 없습니다.") + '</p>' +
        (book.infoLink ? '<a href="' + book.infoLink + '" target="_blank" rel="noopener" class="btn btn-secondary" style="margin-top:24px;display:inline-block;">Google Books에서 자세히 보기 ↗</a>' : '') +
      '</div>';
  }

  window.showBookDetail = function(id) {
    state.currentDetailBookId = id;
    showView("book-detail");
    showLoader("도서 정보를 불러오고 있어요...");

    var book = state.booksCache[id];
    var p = book ? Promise.resolve(book) : fetchBookById(id);

    p.then(function(b) {
      if (!state.booksCache[id]) state.booksCache[id] = b;
      renderBookDetail(b);
      renderReviewSection(id);
    }).catch(function(err) {
      console.error(err);
      var card = el("book-detail-card");
      if (card) card.innerHTML =
        '<p style="grid-column:1/-1;text-align:center;padding:40px 0;color:var(--color-text-secondary);">도서 정보를 불러오지 못했습니다.<br>잠시 후 다시 시도해 주세요.</p>';
    }).finally(function() {
      hideLoader();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  };

  /* -------------------------------------------------------------------------
   * 9. 평점 및 리뷰 (localStorage)
   * ----------------------------------------------------------------------- */
  function loadAllReviews() {
    try { return JSON.parse(localStorage.getItem(REVIEWS_KEY)) || {}; }
    catch (_) { return {}; }
  }

  function saveAllReviews(data) {
    localStorage.setItem(REVIEWS_KEY, JSON.stringify(data));
  }

  function getReviewsForBook(bookId) { return loadAllReviews()[bookId] || []; }

  function setReviewsForBook(bookId, reviews) {
    var all = loadAllReviews();
    all[bookId] = reviews;
    saveAllReviews(all);
  }

  function starsDisplayHTML(avg) {
    var rounded = Math.round(avg), html = "";
    for (var i = 1; i <= 5; i++)
      html += '<span style="color:' + (i <= rounded ? "var(--color-gold)" : "var(--color-border)") + ';font-size:18px;">★</span>';
    return html;
  }

  function starPickerHTML(n) {
    var html = "";
    for (var i = 1; i <= 5; i++)
      html += '<span onclick="setPendingRating(' + i + ')" style="cursor:pointer;font-size:26px;line-height:1;margin-right:4px;color:' + (i <= n ? "var(--color-gold)" : "var(--color-border)") + ';">★</span>';
    return html;
  }

  window.setPendingRating = function(n) {
    state.pendingRating = n;
    var picker = el("review-star-picker");
    if (picker) picker.innerHTML = starPickerHTML(n);
  };

  function reviewFormHTML(bookId) {
    var editing = state.editingReviewId;
    var prefillText = "";
    if (editing) {
      var found = getReviewsForBook(bookId).find(function(r) { return r.id === editing; });
      if (found) { prefillText = found.comment; state.pendingRating = found.rating; }
      else { state.editingReviewId = null; state.pendingRating = 0; }
    } else { state.pendingRating = 0; }

    return '<div class="card" style="padding:28px;background-color:var(--color-bg-secondary);border:1px solid var(--color-border);">' +
      '<h4 style="font-size:16px;font-weight:700;margin-bottom:16px;">' + (editing ? "리뷰 수정하기" : "리뷰 작성하기") + '</h4>' +
      '<div id="review-star-picker" style="margin-bottom:14px;">' + starPickerHTML(state.pendingRating) + '</div>' +
      '<textarea id="review-comment-input" class="form-control" rows="3" placeholder="이 책에 대한 감상을 한 줄, 혹은 몇 줄로 남겨주세요." style="resize:none;margin-bottom:14px;background-color:var(--color-white);line-height:1.7;">' + escapeHTML(prefillText) + '</textarea>' +
      '<div style="display:flex;gap:10px;">' +
        '<button type="button" class="btn btn-primary" style="padding:10px 24px;" onclick="submitReview(\'' + escapeHTML(bookId) + '\')">' + (editing ? "수정 완료" : "리뷰 등록") + '</button>' +
        (editing ? '<button type="button" class="btn btn-secondary" style="padding:10px 24px;" onclick="cancelEditReview(\'' + escapeHTML(bookId) + '\')">취소</button>' : '') +
      '</div></div>';
  }

  function reviewCardHTML(review, bookId) {
    var dateStr = new Date(review.updatedAt || review.createdAt).toLocaleDateString("ko-KR");
    var stars   = "★".repeat(review.rating) + "☆".repeat(5 - review.rating);
    return '<div class="card" style="padding:24px;display:flex;flex-direction:column;gap:10px;">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">' +
        '<div class="star-rating" style="color:var(--color-gold);font-size:15px;letter-spacing:1px;">' + stars + '</div>' +
        '<span style="font-size:12px;color:var(--color-text-tertiary);white-space:nowrap;">' + dateStr + (review.updatedAt ? " (수정됨)" : "") + '</span>' +
      '</div>' +
      '<p style="font-size:14px;line-height:1.8;color:var(--color-text-primary);white-space:pre-line;margin:0;">' + escapeHTML(review.comment) + '</p>' +
      '<div style="display:flex;gap:8px;margin-top:6px;">' +
        '<button class="btn btn-secondary" style="padding:6px 14px;font-size:12px;" onclick="startEditReview(\'' + escapeHTML(bookId) + '\',\'' + escapeHTML(review.id) + '\')">수정</button>' +
        '<button class="btn btn-secondary" style="padding:6px 14px;font-size:12px;" onclick="deleteReview(\'' + escapeHTML(bookId) + '\',\'' + escapeHTML(review.id) + '\')">삭제</button>' +
      '</div></div>';
  }

  function renderReviewSection(bookId) {
    var reviews = getReviewsForBook(bookId).slice().sort(function(a, b) {
      return (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt);
    });
    var avg = reviews.length
      ? reviews.reduce(function(s, r) { return s + r.rating; }, 0) / reviews.length
      : 0;

    var avgRating  = el("detail-avg-rating");
    var avgStars   = el("detail-avg-stars");
    var reviewCount = el("detail-review-count");
    var writeBlock = el("write-review-block");
    var list       = el("reviews-list-container");

    if (avgRating)   avgRating.textContent   = avg.toFixed(1);
    if (avgStars)    avgStars.innerHTML       = starsDisplayHTML(avg);
    if (reviewCount) reviewCount.textContent  = "전체 리뷰 " + reviews.length + "개";
    if (writeBlock)  writeBlock.innerHTML     = reviewFormHTML(bookId);
    if (list) {
      list.innerHTML = reviews.length
        ? reviews.map(function(r) { return reviewCardHTML(r, bookId); }).join("")
        : '<p style="text-align:center;padding:40px 0;color:var(--color-text-tertiary);background-color:var(--color-white);border:1px solid var(--color-border);">가장 먼저 이 책에 대한 감상을 남겨보세요.</p>';
    }
  }

  window.submitReview = function(bookId) {
    var rating    = state.pendingRating;
    var commentEl = el("review-comment-input");
    var comment   = commentEl ? commentEl.value.trim() : "";
    if (!rating)  { notify("별점을 선택해 주세요."); return; }
    if (!comment) { notify("감상평을 입력해 주세요."); return; }

    var reviews = getReviewsForBook(bookId);
    if (state.editingReviewId) {
      reviews = reviews.map(function(r) {
        return r.id === state.editingReviewId
          ? Object.assign({}, r, { rating: rating, comment: comment, updatedAt: Date.now() })
          : r;
      });
      state.editingReviewId = null;
    } else {
      reviews.push({
        id: "rv_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
        rating: rating, comment: comment, createdAt: Date.now(),
      });
    }
    setReviewsForBook(bookId, reviews);
    state.pendingRating = 0;
    renderReviewSection(bookId);
    notify("리뷰가 저장되었습니다.");
  };

  window.startEditReview = function(bookId, reviewId) {
    state.editingReviewId = reviewId;
    renderReviewSection(bookId);
    var block = el("write-review-block");
    if (block) block.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  window.cancelEditReview = function(bookId) {
    state.editingReviewId = null;
    state.pendingRating   = 0;
    renderReviewSection(bookId);
  };

  window.deleteReview = function(bookId, reviewId) {
    if (!confirm("이 리뷰를 삭제하시겠습니까?")) return;
    var reviews = getReviewsForBook(bookId).filter(function(r) { return r.id !== reviewId; });
    setReviewsForBook(bookId, reviews);
    if (state.editingReviewId === reviewId) state.editingReviewId = null;
    renderReviewSection(bookId);
    notify("리뷰가 삭제되었습니다.");
  };

  /* -------------------------------------------------------------------------
   * 10. 초기화
   * ----------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", function() {
    window.navigateTo("home");
  });

})();
