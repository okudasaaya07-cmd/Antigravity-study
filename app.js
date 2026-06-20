/* ==========================================================================
   La Librairie — app.js  (최종 버전)
   ========================================================================== */
(function () {
  "use strict";

  /* ▼ Google Books API 키 — 없어도 되지만 있으면 안정적 */
  var API_KEY = "";

  /* ==========================================================
   * 0. 전역 상태
   * ======================================================== */
  var state = {
    activeView:       "home",
    lastMainView:     "home",
    selectedGenres:   new Set(),
    booksCache:       {},
    editingReviewId:  null,
    pendingRating:    0,
  };

  /* 검색 페이지네이션 전용 */
  var pg = {
    apiQ:      "",   /* API에 보낸 q (prefix 포함) */
    rawQ:      "",   /* 사용자 입력 원본 */
    nextIdx:   0,    /* 다음 fetchPage 의 startIndex */
    total:     0,    /* API totalItems */
    busy:      false,
  };

  var REVIEWS_KEY = "laLibrairieReviews_v1";
  var API_URL     = "https://www.googleapis.com/books/v1/volumes";
  var PAGE        = 40; /* 1회 최대 */

  /* ==========================================================
   * 1. 유틸
   * ======================================================== */
  function esc(s) {
    if (s == null) return "";
    return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;")
      .replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
  }
  function clip(s, n) { return s && s.length > n ? s.slice(0,n).trim()+"…" : (s||""); }
  function plain(s)   { return (s||"").replace(/<br\s*\/?>/gi,"\n").replace(/<\/p>/gi,"\n\n").replace(/<[^>]+>/g,"").trim(); }
  function shuffle(a) { for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=a[i];a[i]=a[j];a[j]=t;} return a; }
  function $id(id)    { return document.getElementById(id); }
  function show(id)   { var e=$id(id); if(e) e.style.display="block"; }
  function hide(id)   { var e=$id(id); if(e) e.style.display="none"; }

  function showLoader(msg) {
    var l=$id("global-loader"), m=$id("loader-message");
    if(m) m.textContent = msg||"불러오는 중입니다...";
    if(l) l.style.display = "flex";
  }
  function hideLoader() { var l=$id("global-loader"); if(l) l.style.display="none"; }

  function toast(msg) {
    var t=$id("app-toast");
    if(!t){
      t=document.createElement("div"); t.id="app-toast";
      Object.assign(t.style,{position:"fixed",bottom:"32px",left:"50%",transform:"translateX(-50%)",
        background:"var(--color-text-primary)",color:"var(--color-white)",padding:"14px 28px",
        borderRadius:"3px",fontSize:"14px",zIndex:"2000",opacity:"0",transition:"opacity .3s",
        maxWidth:"90vw",textAlign:"center"});
      document.body.appendChild(t);
    }
    t.textContent=msg; t.style.opacity="1";
    clearTimeout(window.__tt);
    window.__tt=setTimeout(function(){ t.style.opacity="0"; },2800);
  }

  /* ==========================================================
   * 2. 화면 전환
   * ======================================================== */
  function showView(id) {
    document.querySelectorAll(".view-section").forEach(function(e){ e.classList.remove("active"); });
    var v=$id("view-"+id); if(v) v.classList.add("active");
    document.querySelectorAll(".nav-tab").forEach(function(e){ e.classList.remove("active"); });
    var tab=$id("tab-"+id); if(tab) tab.classList.add("active");
    state.activeView=id;
    window.scrollTo({top:0,behavior:"smooth"});
  }
  window.navigateTo = function(id) {
    showView(id);
    if(id!=="book-detail") state.lastMainView=id;
    /* 검색 탭 첫 진입 시 기본 도서 자동 로드 */
    if(id==="search"){
      var grid=$id("search-results-grid");
      if(grid && !grid.children.length && !pg.busy) loadDefaultBooks();
    }
  };
  window.navigateBack = function() { showView(state.lastMainView||"home"); };

  /* ==========================================================
   * 3. Google Books API
   * ======================================================== */
  function norm(item) {
    var i=item.volumeInfo||{}, lk=i.imageLinks||{};
    var th=lk.thumbnail||lk.smallThumbnail||null;
    if(th) th=th.replace(/^http:/,"https:");
    return {
      id:item.id, title:i.title||"제목 미상",
      authors:(i.authors&&i.authors.length)?i.authors.join(", "):"작가 미상",
      publisher:i.publisher||"", publishedDate:i.publishedDate||"",
      description:i.description||"", categories:i.categories||[],
      thumbnail:th, infoLink:i.infoLink||i.canonicalVolumeLink||null,
    };
  }

  /* 단일 페이지 요청 → { items, total } */
  function fetchPage(q, startIndex) {
    var p=new URLSearchParams({q:q});
    p.set("maxResults",String(PAGE));
    p.set("startIndex",String(startIndex||0));
    if(API_KEY) p.set("key",API_KEY);
    return fetch(API_URL+"?"+p.toString())
      .then(function(r){ if(!r.ok) throw new Error("status "+r.status); return r.json(); })
      .then(function(d){ return { items:(d.items||[]).map(norm), total:d.totalItems||0 }; });
  }

  /* 실패해도 빈 결과 반환 (추가 로드용) */
  function safeFetch(q, startIndex) {
    return fetchPage(q,startIndex).catch(function(){ return {items:[],total:0}; });
  }

  /* ==========================================================
   * 4. 도서 카드 HTML
   * ======================================================== */
  function cardHTML(book, reason) {
    var yr=book.publishedDate?book.publishedDate.slice(0,4):"";
    var ds=clip(plain(book.description),90);
    var sid=esc(book.id);
    return '<div class="card" style="cursor:pointer;display:flex;flex-direction:column;overflow:hidden;height:100%;" onclick="showBookDetail(\''+sid+'\')">' +
      '<div style="width:100%;height:260px;background-color:var(--color-bg-secondary);display:flex;align-items:center;justify-content:center;overflow:hidden;">' +
        (book.thumbnail?'<img src="'+book.thumbnail+'" loading="lazy" style="width:100%;height:100%;object-fit:cover;" onerror="this.parentElement.innerHTML=\'<span style=\\\'font-size:36px;\\\'>📕</span>\'">'
                       :'<span style="font-size:36px;">📕</span>') +
      '</div>' +
      '<div style="padding:20px;display:flex;flex-direction:column;gap:8px;flex-grow:1;">' +
        '<h4 style="font-size:16px;font-weight:700;line-height:1.4;margin:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">'+esc(book.title)+'</h4>' +
        '<p style="font-size:13px;color:var(--color-text-secondary);margin:0;">'+esc(book.authors)+(yr?" · "+yr:"")+'</p>' +
        '<p style="font-size:13px;color:var(--color-text-tertiary);line-height:1.6;margin:0;flex-grow:1;">'+(esc(ds)||"도서 소개가 준비중입니다.")+'</p>' +
        (reason?'<div style="margin-top:6px;padding:12px 14px;background-color:var(--color-bg-secondary);border-left:3px solid var(--color-gold);font-size:13px;font-style:italic;line-height:1.6;">'+esc(reason)+'</div>':"") +
      '</div></div>';
  }

  /* ==========================================================
   * 5. 검색 결과 렌더링 헬퍼
   * ======================================================== */
  function appendCards(books, append) {
    var grid=$id("search-results-grid"); if(!grid) return;
    var html=books.map(function(b){ return cardHTML(b,null); }).join("");
    if(append) grid.insertAdjacentHTML("beforeend",html); else grid.innerHTML=html;
  }

  function refreshSummary() {
    var el=$id("search-results-summary"); if(!el) return;
    var cnt=($id("search-results-grid")||{querySelectorAll:function(){return[];}}).querySelectorAll(".card").length;
    el.textContent="'"+pg.rawQ+"'에 대한 검색 결과 "+cnt+"건"+(pg.total>0?" (전체 약 "+pg.total.toLocaleString()+"건)":"");
    el.style.display="block";
  }

  /* 더 불러오기 버튼 표시 여부 갱신 */
  function refreshBtn() {
    var wrap=$id("load-more-wrap"); if(!wrap) return;
    /* nextIdx < total 이고 API 한계(500) 미만이면 버튼 표시 */
    var show = (pg.total > 0) && (pg.nextIdx < pg.total) && (pg.nextIdx < 500);
    wrap.style.display = show ? "block" : "none";
  }

  function showEmpty(l1, l2) {
    var grid=$id("search-results-grid"), sum=$id("search-results-summary"),
        emp=$id("search-empty-state"),   wrap=$id("load-more-wrap");
    if(grid) grid.innerHTML="";
    if(sum)  sum.style.display="none";
    if(wrap) wrap.style.display="none";
    if(emp) {
      var ps=emp.querySelectorAll("p");
      if(ps[0]) ps[0].textContent=l1||"해당 도서를 서재에서 찾지 못했습니다.";
      if(ps[1]) ps[1].textContent=l2||"다른 키워드로 검색해 보세요.";
      emp.style.display="block";
    }
  }

  /* ==========================================================
   * 6. 검색 실행
   * ======================================================== */
  function buildQ(raw, type) {
    if(type==="title")  return "intitle:"+raw;
    if(type==="author") return "inauthor:"+raw;
    if(type==="genre")  return "subject:"+raw;
    return raw;
  }

  function doSearch(rawQ, type) {
    var q=(rawQ||"").trim();
    if(!q){ toast("검색어를 입력해 주세요."); return; }

    /* 상태 초기화 */
    pg.rawQ=""; pg.apiQ=""; pg.nextIdx=0; pg.total=0; pg.busy=false;

    var empty=$id("search-empty-state"); if(empty) empty.style.display="none";
    var wrap=$id("load-more-wrap"); if(wrap) wrap.style.display="none";

    showLoader("도서를 검색하고 있어요...");

    var prefixQ=buildQ(q,type); /* 접두어 포함 쿼리 (type=all이면 q와 동일) */

    /* ── 1차: prefix 쿼리 시도 ──
       실패(HTTP 오류) 또는 결과 0건이면 단순 쿼리로 재시도 */
    fetchPage(prefixQ, 0)
      .catch(function(err){
        console.warn("1차 실패, 단순 쿼리 재시도:", err.message);
        return fetchPage(q, 0);
      })
      .then(function(r){
        /* 결과가 비어 있고 접두어를 붙인 쿼리였다면 단순 쿼리 재시도 */
        if(!r.items.length && prefixQ !== q){
          console.warn("접두어 쿼리 결과 0건, 단순 쿼리 재시도:", q);
          return fetchPage(q, 0);
        }
        return r;
      })
      .then(function(r){
        /* 결과가 있으면 접두어 쿼리, 없으면 단순 쿼리로 더 불러오기 */
        var finalQ = (r.items.length && prefixQ !== q) ? prefixQ : q;

        /* 상태 저장 */
        pg.rawQ   = q;
        pg.apiQ   = finalQ;
        pg.total  = r.total;
        pg.nextIdx = PAGE;   /* 다음 요청은 40번부터 */

        hideLoader();

        if(!r.items.length){
          showEmpty("해당 도서를 서재에서 찾지 못했습니다.", "다른 키워드로 검색해 보세요.");
          return;
        }

        r.items.forEach(function(b){ state.booksCache[b.id]=b; });
        appendCards(r.items, false);
        refreshSummary();
        refreshBtn();

        /* ── 2·3페이지 조용히 로드 (레이트 리밋 방지: 400ms 간격) ── */
        function silentLoad(si) {
          /* pg.total 이 아직 0 이면(API 버그) 일단 시도 */
          if(pg.total > 0 && si >= pg.total) return;
          if(si >= 500) return;
          setTimeout(function(){
            safeFetch(pg.apiQ, si).then(function(r2){
              var fresh=r2.items.filter(function(b){
                if(state.booksCache[b.id]) return false;
                state.booksCache[b.id]=b; return true;
              });
              if(fresh.length){ appendCards(fresh,true); refreshSummary(); }
              /* nextIdx 를 여기까지 진행된 위치로 업데이트 */
              if(pg.nextIdx <= si) pg.nextIdx = si + PAGE;
              refreshBtn();
            });
          }, si===PAGE ? 500 : 1100); /* page2: 0.5s, page3: 1.1s */
        }
        silentLoad(PAGE);       /* page 2 (startIndex 40)  */
        silentLoad(PAGE*2);     /* page 3 (startIndex 80)  */
      })
      .catch(function(err){
        console.error("검색 실패:", err);
        hideLoader();
        showEmpty("도서 정보를 불러오는 중 문제가 발생했습니다.", "네트워크를 확인하거나 잠시 후 다시 시도해 주세요.");
      });
  }

  /* ──────────────────────────────────────────────────────────
   * "더 불러오기" 버튼 핸들러
   * index.html: <button onclick="loadMoreResults()">더 불러오기</button>
   * ────────────────────────────────────────────────────────── */
  window.loadMoreResults = function() {
    if(pg.busy) return;

    /* pg.total 이 0 이어도(API 미반환) nextIdx 가 0 이 아니면 시도 */
    if(pg.total > 0 && pg.nextIdx >= pg.total){ refreshBtn(); return; }
    if(pg.nextIdx >= 500){ refreshBtn(); return; }
    if(!pg.apiQ){ return; }   /* 검색한 적 없음 */

    pg.busy = true;
    var btn=$id("load-more-btn");
    if(btn){ btn.disabled=true; btn.textContent="불러오는 중..."; }

    var startIdx = pg.nextIdx;
    pg.nextIdx  += PAGE;       /* 미리 이동 (중복 방지) */

    safeFetch(pg.apiQ, startIdx)
      .then(function(r){
        /* total 갱신 (첫 로드 때 0 이었던 경우 보정) */
        if(r.total > 0) pg.total = r.total;

        var fresh=r.items.filter(function(b){
          if(state.booksCache[b.id]) return false;
          state.booksCache[b.id]=b; return true;
        });

        if(fresh.length){
          appendCards(fresh, true);
          refreshSummary();
        } else if(r.items.length===0 && pg.total===0){
          /* 결과가 아예 없으면 버튼 숨기기 */
          pg.total = startIdx; /* total 을 현재 위치로 고정 */
        }

        pg.busy=false;
        if(btn){ btn.disabled=false; btn.textContent="더 불러오기"; }
        refreshBtn();
      });
  };

  /* index.html: onsubmit="handleSearch(event)" */
  window.handleSearch = function(e) {
    e.preventDefault();
    doSearch(
      $id("search-input") ? $id("search-input").value : "",
      $id("search-type")  ? $id("search-type").value  : "all"
    );
  };

  /* index.html: onsubmit="handleHomeSearch(event)" */
  window.handleHomeSearch = function(e) {
    e.preventDefault();
    var q=($id("home-search-input")||{}).value||"";
    q=q.trim();
    if(!q){ toast("검색어를 입력해 주세요."); return; }
    window.navigateTo("search");
    if($id("search-input")) $id("search-input").value=q;
    if($id("search-type"))  $id("search-type").value="all";
    doSearch(q,"all");
  };

  /* ==========================================================
   * 7. AI 추천
   * ======================================================== */
  window.toggleGenreSelection = function(btn, genre) {
    if(state.selectedGenres.has(genre)){
      state.selectedGenres.delete(genre);
      btn.classList.remove("selected");
      btn.style.backgroundColor=btn.style.color=btn.style.borderColor=btn.style.fontWeight="";
    } else {
      state.selectedGenres.add(genre);
      btn.classList.add("selected");
      btn.style.backgroundColor="var(--color-gold)";
      btn.style.color="var(--color-white)";
      btn.style.borderColor="var(--color-gold)";
      btn.style.fontWeight="700";
    }
  };

  function craftReason(book, style, kw, idx) {
    var t=[
      function(){ return '"'+style+'"를 찾는 마음에, 「'+book.title+'」가 차분히 다가와 그 결을 채워줄 책입니다.'; },
      function(){ return '「'+book.title+'」은 '+(kw?'\''+clip(kw,24)+'\'라는 마음':'지금 이 순간의 마음')+'에 또 하나의 결을 더해줄 한 권입니다.'; },
      function(){ return '한 장씩 넘길 때마다, 「'+book.title+'」은 '+style+'에 가장 가까운 결을 지닌 책으로 다가올 것입니다.'; },
      function(){ return '지금 머무는 생각의 결을 따라가 보면, 「'+book.title+'」만큼 어울리는 책을 찾기 어려울 것입니다.'; },
      function(){ return (book.categories.length?book.categories[0]+' 서가에서, ':'')+'「'+book.title+'」은 오늘의 당신에게 조용히 건네는 한 권의 위안입니다.'; },
    ];
    return t[idx%t.length]();
  }

  window.handleRecommendation = function(e) {
    e.preventDefault();
    var genres  =Array.from(state.selectedGenres);
    var kw      =($id("recommend-keywords")||{}).value||""; kw=kw.trim();
    var style   =($id("recommend-style")||{}).value||"";
    if(!genres.length&&!kw){ toast("선호 장르를 선택하거나 키워드를 입력해 주세요."); return; }

    showLoader("당신의 결을 닮은 책을 고르고 있어요...");

    var queries=genres.length?genres.map(function(g){ return kw?g+" "+kw:g; }):[kw||"추천 도서"];
    var all={}, wt={}, idx=0;

    function next(){
      if(idx>=queries.length){
        hideLoader();
        var pool=Object.values(wt); if(pool.length<5) pool=Object.values(all);
        if(!pool.length){ toast("조건에 맞는 도서를 찾지 못했습니다."); return; }
        shuffle(pool);
        var picks=pool.slice(0,5);
        picks.forEach(function(b){ state.booksCache[b.id]=b; });
        var grid=$id("recommend-grid");
        if(grid) grid.innerHTML=picks.map(function(b,i){ return cardHTML(b,craftReason(b,style,kw,i)); }).join("");
        var fw=$id("recommend-form-wrapper"), rw=$id("recommend-results-wrapper");
        if(fw) fw.style.display="none"; if(rw) rw.style.display="block";
        window.scrollTo({top:0,behavior:"smooth"});
        return;
      }
      var q=queries[idx++];
      setTimeout(function(){
        safeFetch(q,0).then(function(r){
          r.items.forEach(function(b){ all[b.id]=b; if(b.thumbnail) wt[b.id]=b; });
          next();
        });
      }, idx>1?350:0);
    }
    next();
  };

  window.resetRecommendations = function() {
    var fw=$id("recommend-form-wrapper"), rw=$id("recommend-results-wrapper");
    if(rw) rw.style.display="none"; if(fw) fw.style.display="block";
    window.scrollTo({top:0,behavior:"smooth"});
  };

  /* ==========================================================
   * 8. 도서 상세
   * ======================================================== */
  function renderDetail(book) {
    var card=$id("book-detail-card"); if(!card) return;
    var cats=book.categories.length?book.categories.join(", "):"";
    var yr=book.publishedDate?book.publishedDate.slice(0,4):"";
    card.innerHTML=
      '<div style="background-color:var(--color-bg-secondary);border:1px solid var(--color-border);display:flex;align-items:center;justify-content:center;min-height:380px;overflow:hidden;">' +
        (book.thumbnail?'<img src="'+book.thumbnail+'" style="width:100%;height:100%;object-fit:cover;">'
                       :'<span style="font-size:64px;">📕</span>') +
      '</div>' +
      '<div>' +
        (cats?'<p style="font-size:12px;letter-spacing:.1em;color:var(--color-gold-dark);text-transform:uppercase;font-weight:700;margin-bottom:10px;">'+esc(cats)+'</p>':'') +
        '<h1 style="font-size:30px;font-weight:800;line-height:1.3;margin-bottom:10px;">'+esc(book.title)+'</h1>' +
        '<p style="font-size:16px;color:var(--color-text-secondary);margin-bottom:18px;">'+esc(book.authors)+(book.publisher?" · "+esc(book.publisher):"")+(yr?" · "+yr:"")+'</p>' +
        '<div class="gold-decor left" style="width:40px;margin:0 0 18px;"></div>' +
        '<p style="font-size:15px;line-height:1.9;color:var(--color-text-primary);white-space:pre-line;">'+(book.description?esc(plain(book.description)):"등록된 책 소개가 없습니다.")+'</p>' +
        (book.infoLink?'<a href="'+book.infoLink+'" target="_blank" rel="noopener" class="btn btn-secondary" style="margin-top:24px;display:inline-block;">Google Books에서 자세히 보기 ↗</a>':'') +
      '</div>';
  }

  window.showBookDetail = function(id) {
    showView("book-detail");
    showLoader("도서 정보를 불러오고 있어요...");
    var book=state.booksCache[id];
    var p=book?Promise.resolve(book):
      fetch(API_URL+"/"+id+(API_KEY?"?key="+API_KEY:""))
        .then(function(r){ if(!r.ok) throw new Error("status "+r.status); return r.json(); })
        .then(norm);
    p.then(function(b){
      state.booksCache[id]=b;
      renderDetail(b);
      renderReviews(id);
      hideLoader();
      window.scrollTo({top:0,behavior:"smooth"});
    }).catch(function(err){
      console.error(err);
      hideLoader();
      var c=$id("book-detail-card");
      if(c) c.innerHTML='<p style="grid-column:1/-1;text-align:center;padding:40px 0;color:var(--color-text-secondary);">도서 정보를 불러오지 못했습니다.<br>잠시 후 다시 시도해 주세요.</p>';
    });
  };

  /* ==========================================================
   * 9. 리뷰
   * ======================================================== */
  function allReviews()        { try{ return JSON.parse(localStorage.getItem(REVIEWS_KEY))||{}; }catch(_){ return {}; } }
  function saveAll(data)       { localStorage.setItem(REVIEWS_KEY,JSON.stringify(data)); }
  function getR(id)            { return allReviews()[id]||[]; }
  function setR(id,arr)        { var a=allReviews(); a[id]=arr; saveAll(a); }

  function starsHTML(avg) {
    var r=Math.round(avg),h="";
    for(var i=1;i<=5;i++) h+='<span style="color:'+(i<=r?"var(--color-gold)":"var(--color-border)")+';font-size:18px;">★</span>';
    return h;
  }
  function pickerHTML(n) {
    var h="";
    for(var i=1;i<=5;i++) h+='<span onclick="setPendingRating('+i+')" style="cursor:pointer;font-size:26px;line-height:1;margin-right:4px;color:'+(i<=n?"var(--color-gold)":"var(--color-border)")+';">★</span>';
    return h;
  }
  window.setPendingRating=function(n){ state.pendingRating=n; var e=$id("review-star-picker"); if(e) e.innerHTML=pickerHTML(n); };

  function frmHTML(bookId) {
    var ed=state.editingReviewId, pre="";
    if(ed){
      var f=getR(bookId).find(function(r){ return r.id===ed; });
      if(f){ pre=f.comment; state.pendingRating=f.rating; } else { state.editingReviewId=null; state.pendingRating=0; }
    } else { state.pendingRating=0; }
    return '<div class="card" style="padding:28px;background-color:var(--color-bg-secondary);border:1px solid var(--color-border);">' +
      '<h4 style="font-size:16px;font-weight:700;margin-bottom:16px;">'+(ed?"리뷰 수정하기":"리뷰 작성하기")+'</h4>' +
      '<div id="review-star-picker" style="margin-bottom:14px;">'+pickerHTML(state.pendingRating)+'</div>' +
      '<textarea id="review-comment-input" class="form-control" rows="3" placeholder="이 책에 대한 감상을 남겨주세요." style="resize:none;margin-bottom:14px;background-color:var(--color-white);line-height:1.7;">'+esc(pre)+'</textarea>' +
      '<div style="display:flex;gap:10px;">' +
        '<button type="button" class="btn btn-primary" style="padding:10px 24px;" onclick="submitReview(\''+esc(bookId)+'\')">'+(ed?"수정 완료":"리뷰 등록")+'</button>' +
        (ed?'<button type="button" class="btn btn-secondary" style="padding:10px 24px;" onclick="cancelEditReview(\''+esc(bookId)+'\')">취소</button>':"") +
      '</div></div>';
  }

  function rvHTML(r,bookId) {
    var d=new Date(r.updatedAt||r.createdAt).toLocaleDateString("ko-KR");
    return '<div class="card" style="padding:24px;display:flex;flex-direction:column;gap:10px;">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">' +
        '<div style="color:var(--color-gold);font-size:15px;letter-spacing:1px;">'+"★".repeat(r.rating)+"☆".repeat(5-r.rating)+'</div>' +
        '<span style="font-size:12px;color:var(--color-text-tertiary);white-space:nowrap;">'+d+(r.updatedAt?" (수정됨)":"")+'</span>' +
      '</div>' +
      '<p style="font-size:14px;line-height:1.8;color:var(--color-text-primary);white-space:pre-line;margin:0;">'+esc(r.comment)+'</p>' +
      '<div style="display:flex;gap:8px;margin-top:6px;">' +
        '<button class="btn btn-secondary" style="padding:6px 14px;font-size:12px;" onclick="startEditReview(\''+esc(bookId)+'\',\''+esc(r.id)+'\')">수정</button>' +
        '<button class="btn btn-secondary" style="padding:6px 14px;font-size:12px;" onclick="deleteReview(\''+esc(bookId)+'\',\''+esc(r.id)+'\')">삭제</button>' +
      '</div></div>';
  }

  function renderReviews(bookId) {
    var rvs=getR(bookId).slice().sort(function(a,b){ return (b.updatedAt||b.createdAt)-(a.updatedAt||a.createdAt); });
    var avg=rvs.length?rvs.reduce(function(s,r){ return s+r.rating; },0)/rvs.length:0;
    if($id("detail-avg-rating"))   $id("detail-avg-rating").textContent   =avg.toFixed(1);
    if($id("detail-avg-stars"))    $id("detail-avg-stars").innerHTML      =starsHTML(avg);
    if($id("detail-review-count")) $id("detail-review-count").textContent ="전체 리뷰 "+rvs.length+"개";
    if($id("write-review-block"))  $id("write-review-block").innerHTML    =frmHTML(bookId);
    var list=$id("reviews-list-container");
    if(list) list.innerHTML=rvs.length
      ?rvs.map(function(r){ return rvHTML(r,bookId); }).join("")
      :'<p style="text-align:center;padding:40px 0;color:var(--color-text-tertiary);background-color:var(--color-white);border:1px solid var(--color-border);">가장 먼저 이 책에 대한 감상을 남겨보세요.</p>';
  }

  window.submitReview=function(bookId){
    var rating=state.pendingRating, el=$id("review-comment-input"), comment=el?el.value.trim():"";
    if(!rating){ toast("별점을 선택해 주세요."); return; }
    if(!comment){ toast("감상평을 입력해 주세요."); return; }
    var rvs=getR(bookId);
    if(state.editingReviewId){
      rvs=rvs.map(function(r){ return r.id===state.editingReviewId?Object.assign({},r,{rating:rating,comment:comment,updatedAt:Date.now()}):r; });
      state.editingReviewId=null;
    } else {
      rvs.push({id:"rv_"+Date.now()+"_"+Math.random().toString(36).slice(2,7),rating:rating,comment:comment,createdAt:Date.now()});
    }
    setR(bookId,rvs); state.pendingRating=0; renderReviews(bookId); toast("리뷰가 저장되었습니다.");
  };
  window.startEditReview=function(bookId,rvId){ state.editingReviewId=rvId; renderReviews(bookId); var b=$id("write-review-block"); if(b) b.scrollIntoView({behavior:"smooth",block:"center"}); };
  window.cancelEditReview=function(bookId){ state.editingReviewId=null; state.pendingRating=0; renderReviews(bookId); };
  window.deleteReview=function(bookId,rvId){
    if(!confirm("이 리뷰를 삭제하시겠습니까?")) return;
    var rvs=getR(bookId).filter(function(r){ return r.id!==rvId; });
    setR(bookId,rvs); if(state.editingReviewId===rvId) state.editingReviewId=null;
    renderReviews(bookId); toast("리뷰가 삭제되었습니다.");
  };

  /* ==========================================================
   * 10. 기본 도서 로드 (검색 페이지 첫 진입 시)
   * ======================================================== */
  var DEFAULT_QUERIES = [
    "한강 소설",
    "김영하 소설",
    "베스트셀러 자기계발",
    "인문학 철학 추천",
    "역사 교양 도서",
    "과학 에세이 추천",
    "무라카미 하루키",
    "세계 고전 문학",
    "헤르만 헤세",
    "Albert Camus novel"
  ];

  function loadDefaultBooks() {
    pg.busy = true;
    var sum=$id("search-results-summary");
    if(sum){ sum.textContent="라 리브레리 추천 도서를 불러오는 중..."; sum.style.display="block"; }
    var grid=$id("search-results-grid"); if(grid) grid.innerHTML="";
    var wrap=$id("load-more-wrap"); if(wrap) wrap.style.display="none";
    var seen={}, total=0, qi=0;

    function next(){
      if(qi >= DEFAULT_QUERIES.length){
        pg.busy=false;
        if(sum){
          sum.textContent="라 리브레리 추천 도서 "+total+"권";
          sum.style.display="block";
        }
        return;
      }
      var query=DEFAULT_QUERIES[qi++];
      setTimeout(function(){
        safeFetch(query, 0).then(function(r){
          var fresh=r.items.filter(function(b){
            if(seen[b.id]) return false;
            seen[b.id]=true; state.booksCache[b.id]=b; return true;
          });
          if(fresh.length){
            appendCards(fresh, true);
            total+=fresh.length;
            if(sum){ sum.textContent="라 리브레리 추천 도서 "+total+"권"; }
          }
          next();
        });
      }, qi===1 ? 0 : 350);
    }
    next();
  }

  /* ==========================================================
   * 11. 초기화
   * ======================================================== */
  document.addEventListener("DOMContentLoaded", function(){ window.navigateTo("home"); });
})();


