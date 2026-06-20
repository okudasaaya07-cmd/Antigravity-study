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
   * 10. 기본 도서 100권 (API 불필요 — 항상 표시)
   * ======================================================== */
  var OL = "https://covers.openlibrary.org/b/isbn/";
  var PRESET_BOOKS = [
    /* ── 한국 현대소설 ── */
    {id:"p01",title:"채식주의자",authors:"한강",publishedDate:"2007",categories:["소설"],description:"육식을 거부하는 한 여성을 통해 인간의 폭력성과 욕망을 탐구한 맨부커상 수상작.",thumbnail:OL+"9788932025895-M.jpg"},
    {id:"p02",title:"소년이 온다",authors:"한강",publishedDate:"2014",categories:["소설"],description:"1980년 5월 광주를 배경으로, 살아남은 자의 죄책감과 비극을 섬세하게 그린 소설.",thumbnail:OL+"9788936434120-M.jpg"},
    {id:"p03",title:"작별하지 않는다",authors:"한강",publishedDate:"2021",categories:["소설"],description:"제주 4·3 사건을 배경으로 죽은 자와 산 자가 나누는 기억에 관한 이야기.",thumbnail:OL+"9788936434625-M.jpg"},
    {id:"p04",title:"흰",authors:"한강",publishedDate:"2016",categories:["소설"],description:"하얀 것들에 대한 65개의 단상으로 이루어진 한강의 산문소설.",thumbnail:OL+"9788936434182-M.jpg"},
    {id:"p05",title:"82년생 김지영",authors:"조남주",publishedDate:"2016",categories:["소설"],description:"1982년생 평범한 여성의 삶을 통해 한국 사회의 성차별을 날카롭게 조명한 소설.",thumbnail:OL+"9788960402683-M.jpg"},
    {id:"p06",title:"아몬드",authors:"손원평",publishedDate:"2017",categories:["소설"],description:"감정을 느끼지 못하는 소년 윤재의 성장과 우정을 그린 이야기.",thumbnail:OL+"9788954656795-M.jpg"},
    {id:"p07",title:"달러구트 꿈 백화점",authors:"이미예",publishedDate:"2020",categories:["소설"],description:"잠든 사람들의 꿈을 판매하는 신비로운 백화점을 배경으로 한 판타지 소설.",thumbnail:OL+"9791130625454-M.jpg"},
    {id:"p08",title:"불편한 편의점",authors:"김호연",publishedDate:"2022",categories:["소설"],description:"사람들이 모이는 편의점을 배경으로 따뜻한 인간관계를 그린 힐링 소설.",thumbnail:OL+"9791165348366-M.jpg"},
    {id:"p09",title:"7년의 밤",authors:"정유정",publishedDate:"2011",categories:["소설"],description:"한 사고가 두 가족을 7년에 걸쳐 어떻게 파멸시키는지를 그린 스릴러.",thumbnail:OL+"9788954608152-M.jpg"},
    {id:"p10",title:"종의 기원",authors:"정유정",publishedDate:"2016",categories:["소설"],description:"인간의 본성과 악의 기원을 탐구하는 심리 스릴러.",thumbnail:OL+"9788954630108-M.jpg"},
    {id:"p11",title:"파친코",authors:"이민진",publishedDate:"2017",categories:["소설"],description:"일제강점기부터 현대까지 4대에 걸친 재일조선인 가족의 서사.",thumbnail:OL+"9780316346627-M.jpg"},
    {id:"p12",title:"하얼빈",authors:"김훈",publishedDate:"2022",categories:["소설"],description:"안중근 의사의 이토 히로부미 저격까지의 여정을 담은 역사소설.",thumbnail:OL+"9788936434601-M.jpg"},
    {id:"p13",title:"완득이",authors:"김려령",publishedDate:"2008",categories:["소설"],description:"가난하고 고단한 환경에서도 당당하게 성장해가는 소년 완득이의 이야기.",thumbnail:OL+"9788993242423-M.jpg"},
    {id:"p14",title:"우리들의 일그러진 영웅",authors:"이문열",publishedDate:"1987",categories:["소설"],description:"초등학교 교실을 배경으로 권력의 속성을 날카롭게 파헤친 이문열의 대표작.",thumbnail:OL+"9788974748098-M.jpg"},
    {id:"p15",title:"한국이 싫어서",authors:"장강명",publishedDate:"2015",categories:["소설"],description:"한국 사회를 떠나 이민을 결심한 젊은 여성의 이야기.",thumbnail:OL+"9788936434434-M.jpg"},
    {id:"p16",title:"죽고 싶지만 떡볶이는 먹고 싶어",authors:"백세희",publishedDate:"2018",categories:["에세이"],description:"기분부전장애를 앓는 저자와 정신과 의사의 대화를 담은 에세이.",thumbnail:OL+"9791188490417-M.jpg"},
    {id:"p17",title:"언어의 온도",authors:"이기주",publishedDate:"2016",categories:["에세이"],description:"언어가 지닌 힘과 온기에 대한 섬세한 글들을 담은 에세이.",thumbnail:OL+"9791186659205-M.jpg"},
    {id:"p18",title:"나는 나로 살기로 했다",authors:"김수현",publishedDate:"2016",categories:["에세이"],description:"지친 현대인에게 자신을 사랑하는 법을 전하는 에세이.",thumbnail:OL+"9791159471056-M.jpg"},
    {id:"p19",title:"아버지의 해방일지",authors:"정지아",publishedDate:"2022",categories:["소설"],description:"빨치산 출신 아버지와 그 가족의 삶을 그린 감동적인 소설.",thumbnail:OL+"9788936434618-M.jpg"},
    {id:"p20",title:"천 개의 파랑",authors:"천선란",publishedDate:"2020",categories:["SF","소설"],description:"다친 기수 대신 경마에 나서는 로봇 기수를 통해 감정과 존재를 탐구하는 SF.",thumbnail:OL+"9791191211467-M.jpg"},
    /* ── 일본 소설 ── */
    {id:"p21",title:"노르웨이의 숲",authors:"무라카미 하루키",publishedDate:"1987",categories:["소설"],description:"1960년대 도쿄를 배경으로 상실과 성장, 사랑을 담담하게 그린 하루키의 대표작.",thumbnail:OL+"9788937460685-M.jpg"},
    {id:"p22",title:"나미야 잡화점의 기적",authors:"히가시노 게이고",publishedDate:"2012",categories:["소설"],description:"시간을 초월한 편지로 연결되는 사람들의 이야기를 그린 감동 소설.",thumbnail:OL+"9788933864371-M.jpg"},
    {id:"p23",title:"용의자 X의 헌신",authors:"히가시노 게이고",publishedDate:"2005",categories:["추리"],description:"완벽한 알리바이 뒤에 숨겨진 천재의 헌신을 그린 추리소설.",thumbnail:OL+"9788937462443-M.jpg"},
    {id:"p24",title:"인간 실격",authors:"다자이 오사무",publishedDate:"1948",categories:["소설"],description:"인간으로서의 자격을 잃어가는 한 남자의 고백체 소설.",thumbnail:OL+"9788936460358-M.jpg"},
    {id:"p25",title:"설국",authors:"가와바타 야스나리",publishedDate:"1948",categories:["소설"],description:"눈 덮인 온천 마을에서 펼쳐지는 아름답고 쓸쓸한 사랑 이야기.",thumbnail:OL+"9788937462344-M.jpg"},
    {id:"p26",title:"세상의 끝과 하드보일드 원더랜드",authors:"무라카미 하루키",publishedDate:"1985",categories:["소설","SF"],description:"두 개의 평행한 세계를 오가는 하루키 특유의 독창적인 장편소설.",thumbnail:OL+"9788937461118-M.jpg"},
    {id:"p27",title:"1Q84",authors:"무라카미 하루키",publishedDate:"2009",categories:["소설"],description:"1984년과 다른 달이 두 개인 세계, 1Q84에서 펼쳐지는 두 남녀의 운명적 이야기.",thumbnail:OL+"9788937461026-M.jpg"},
    {id:"p28",title:"나는 고양이로소이다",authors:"나쓰메 소세키",publishedDate:"1905",categories:["소설"],description:"고양이의 시선으로 메이지 시대 일본 지식인 사회를 풍자한 소설.",thumbnail:OL+"9788934980940-M.jpg"},
    {id:"p29",title:"도련님",authors:"나쓰메 소세키",publishedDate:"1906",categories:["소설"],description:"도쿄 출신 청년 교사가 시골 학교에서 겪는 좌충우돌을 그린 소설.",thumbnail:OL+"9788937460562-M.jpg"},
    {id:"p30",title:"악의",authors:"히가시노 게이고",publishedDate:"1996",categories:["추리"],description:"범인을 처음부터 밝히지만 진짜 동기가 무엇인지를 추적하는 역발상 추리소설.",thumbnail:OL+"9788937462450-M.jpg"},
    /* ── 서양 고전 ── */
    {id:"p31",title:"어린 왕자",authors:"앙투안 드 생텍쥐페리",publishedDate:"1943",categories:["소설"],description:"사막에 불시착한 조종사와 어린 왕자의 만남을 통해 삶의 본질을 이야기하는 작품.",thumbnail:OL+"9788937460678-M.jpg"},
    {id:"p32",title:"데미안",authors:"헤르만 헤세",publishedDate:"1919",categories:["소설"],description:"자아를 찾아가는 에밀 싱클레어의 성장 이야기.",thumbnail:OL+"9788937460555-M.jpg"},
    {id:"p33",title:"수레바퀴 아래서",authors:"헤르만 헤세",publishedDate:"1906",categories:["소설"],description:"시대의 압박 속에서 짓눌리는 한 소년의 비극적 성장을 그린 소설.",thumbnail:OL+"9788937460524-M.jpg"},
    {id:"p34",title:"싯다르타",authors:"헤르만 헤세",publishedDate:"1922",categories:["소설","철학"],description:"깨달음을 찾아 떠나는 젊은 브라만 싯다르타의 정신적 여정.",thumbnail:OL+"9788937460517-M.jpg"},
    {id:"p35",title:"이방인",authors:"알베르 카뮈",publishedDate:"1942",categories:["소설","철학"],description:"태양 때문에 살인을 저지른 뫼르소를 통해 부조리를 탐구한 카뮈의 대표작.",thumbnail:OL+"9788937460623-M.jpg"},
    {id:"p36",title:"페스트",authors:"알베르 카뮈",publishedDate:"1947",categories:["소설","철학"],description:"전염병이 창궐한 도시에서 인간의 연대와 고독을 그린 카뮈의 걸작.",thumbnail:OL+"9788936432003-M.jpg"},
    {id:"p37",title:"오만과 편견",authors:"제인 오스틴",publishedDate:"1813",categories:["소설"],description:"엘리자베스 베넷과 다아시의 사랑을 통해 18세기 영국 사회를 풍자한 소설.",thumbnail:OL+"9788937460296-M.jpg"},
    {id:"p38",title:"위대한 개츠비",authors:"F. 스콧 피츠제럴드",publishedDate:"1925",categories:["소설"],description:"재즈 시대 미국의 화려함과 허무함을 담은 미국 문학의 고전.",thumbnail:OL+"9788937460357-M.jpg"},
    {id:"p39",title:"1984",authors:"조지 오웰",publishedDate:"1949",categories:["소설","SF"],description:"전체주의 사회의 공포를 그린 디스토피아 소설의 고전.",thumbnail:OL+"9788937460630-M.jpg"},
    {id:"p40",title:"동물농장",authors:"조지 오웰",publishedDate:"1945",categories:["소설"],description:"동물들의 혁명을 통해 권력의 부패와 전체주의를 풍자한 우화.",thumbnail:OL+"9788937460609-M.jpg"},
    {id:"p41",title:"호밀밭의 파수꾼",authors:"J.D. 샐린저",publishedDate:"1951",categories:["소설"],description:"학교에서 쫓겨난 10대 소년 홀든 콜필드의 방황과 내면을 그린 소설.",thumbnail:OL+"9788937460548-M.jpg"},
    {id:"p42",title:"죄와 벌",authors:"표도르 도스토예프스키",publishedDate:"1866",categories:["소설"],description:"가난한 대학생 라스콜리니코프의 살인과 그 이후의 심리를 그린 심리소설.",thumbnail:OL+"9788937462269-M.jpg"},
    {id:"p43",title:"변신",authors:"프란츠 카프카",publishedDate:"1915",categories:["소설"],description:"어느 날 아침 거대한 벌레로 변해버린 그레고르 잠자의 이야기.",thumbnail:OL+"9788937460531-M.jpg"},
    {id:"p44",title:"노인과 바다",authors:"어니스트 헤밍웨이",publishedDate:"1952",categories:["소설"],description:"늙은 어부 산티아고와 거대한 청새치의 사투를 담은 퓰리처상 수상작.",thumbnail:OL+"9788937460593-M.jpg"},
    {id:"p45",title:"제인 에어",authors:"샬럿 브론테",publishedDate:"1847",categories:["소설"],description:"고아 출신 여성 제인 에어의 자립과 사랑을 그린 고전 로맨스.",thumbnail:OL+"9788937460272-M.jpg"},
    {id:"p46",title:"폭풍의 언덕",authors:"에밀리 브론테",publishedDate:"1847",categories:["소설"],description:"히스클리프와 캐서린의 파멸적인 사랑을 그린 영국 문학의 걸작.",thumbnail:OL+"9788937460289-M.jpg"},
    {id:"p47",title:"백년의 고독",authors:"가브리엘 가르시아 마르케스",publishedDate:"1967",categories:["소설"],description:"부엔디아 가문의 7대에 걸친 이야기를 마술적 사실주의로 그린 노벨문학상 수상작.",thumbnail:OL+"9788985175166-M.jpg"},
    {id:"p48",title:"연금술사",authors:"파울로 코엘료",publishedDate:"1988",categories:["소설"],description:"자신의 꿈을 찾아 여행을 떠나는 양치기 소년 산티아고의 이야기.",thumbnail:OL+"9788934969235-M.jpg"},
    {id:"p49",title:"80일간의 세계일주",authors:"쥘 베른",publishedDate:"1872",categories:["소설"],description:"필리어스 포그가 80일 안에 세계를 일주하는 내기를 떠나는 모험소설.",thumbnail:OL+"9788937460326-M.jpg"},
    {id:"p50",title:"몬테크리스토 백작",authors:"알렉상드르 뒤마",publishedDate:"1844",categories:["소설"],description:"억울하게 누명을 쓴 에드몽 당테스의 복수를 그린 대하모험소설.",thumbnail:OL+"9788937460234-M.jpg"},
    /* ── 인문/철학 ── */
    {id:"p51",title:"사피엔스",authors:"유발 노아 하라리",publishedDate:"2011",categories:["역사","인문"],description:"인류의 탄생부터 현재까지를 거시적 관점으로 분석한 세계적 베스트셀러.",thumbnail:OL+"9788934972464-M.jpg"},
    {id:"p52",title:"호모 데우스",authors:"유발 노아 하라리",publishedDate:"2015",categories:["역사","인문"],description:"인류의 미래와 신이 되려는 호모 사피엔스의 욕망을 탐구한 책.",thumbnail:OL+"9788934982753-M.jpg"},
    {id:"p53",title:"21세기를 위한 21가지 제언",authors:"유발 노아 하라리",publishedDate:"2018",categories:["인문"],description:"오늘날 인류가 직면한 21가지 핵심 문제를 다룬 유발 하라리의 세 번째 작품.",thumbnail:OL+"9788934985464-M.jpg"},
    {id:"p54",title:"총균쇠",authors:"재레드 다이아몬드",publishedDate:"1997",categories:["역사","과학"],description:"왜 어떤 문명은 번성하고 어떤 문명은 정복당했는가를 과학적으로 분석한 책.",thumbnail:OL+"9788936434014-M.jpg"},
    {id:"p55",title:"정의란 무엇인가",authors:"마이클 샌델",publishedDate:"2009",categories:["철학"],description:"공정함과 정의에 대한 근본적인 질문을 던지는 하버드 철학 강의.",thumbnail:OL+"9788925539928-M.jpg"},
    {id:"p56",title:"자유로부터의 도피",authors:"에리히 프롬",publishedDate:"1941",categories:["철학","심리"],description:"현대인이 자유를 두려워하고 권위에 복종하는 심리를 분석한 명저.",thumbnail:OL+"9788932019611-M.jpg"},
    {id:"p57",title:"사랑의 기술",authors:"에리히 프롬",publishedDate:"1956",categories:["철학","심리"],description:"사랑은 감정이 아니라 실천이자 기술임을 역설하는 프롬의 대표작.",thumbnail:OL+"9788932019635-M.jpg"},
    {id:"p58",title:"군주론",authors:"니콜로 마키아벨리",publishedDate:"1532",categories:["철학","정치"],description:"권력 유지를 위한 현실적 정치술을 논한 르네상스 시대의 고전.",thumbnail:OL+"9788937460173-M.jpg"},
    {id:"p59",title:"소크라테스의 변명",authors:"플라톤",publishedDate:"-399",categories:["철학"],description:"죽음 앞에서도 철학적 신념을 굽히지 않은 소크라테스의 마지막 변론.",thumbnail:OL+"9788937460128-M.jpg"},
    {id:"p60",title:"니코마코스 윤리학",authors:"아리스토텔레스",publishedDate:"-350",categories:["철학"],description:"행복이란 무엇인가에 대해 탐구하는 아리스토텔레스의 윤리학 강의록.",thumbnail:OL+"9788937460135-M.jpg"},
    /* ── 자기계발 ── */
    {id:"p61",title:"아주 작은 습관의 힘",authors:"제임스 클리어",publishedDate:"2018",categories:["자기계발"],description:"1%의 작은 변화가 어떻게 삶을 바꾸는지를 설명하는 습관 형성 가이드.",thumbnail:OL+"9791191891027-M.jpg"},
    {id:"p62",title:"그릿",authors:"앤절라 더크워스",publishedDate:"2016",categories:["자기계발","심리"],description:"재능보다 열정과 끈기가 성공을 만든다는 그릿(GRIT) 이론을 다룬 책.",thumbnail:OL+"9788991769342-M.jpg"},
    {id:"p63",title:"미라클 모닝",authors:"할 엘로드",publishedDate:"2012",categories:["자기계발"],description:"아침 1시간이 인생을 바꾼다는 모닝 루틴의 힘을 담은 자기계발서.",thumbnail:OL+"9791186659021-M.jpg"},
    {id:"p64",title:"원씽",authors:"게리 켈러",publishedDate:"2013",categories:["자기계발"],description:"지금 당장 해야 할 단 하나의 일에 집중하는 삶의 방법을 담은 책.",thumbnail:OL+"9788996817536-M.jpg"},
    {id:"p65",title:"데일 카네기 인간관계론",authors:"데일 카네기",publishedDate:"1936",categories:["자기계발"],description:"사람을 움직이고 좋은 관계를 맺는 법칙을 담은 자기계발의 고전.",thumbnail:OL+"9788996281634-M.jpg"},
    {id:"p66",title:"부자 아빠 가난한 아빠",authors:"로버트 기요사키",publishedDate:"1997",categories:["자기계발","경제"],description:"돈에 대한 통념을 깨고 경제적 자유를 얻는 방법을 알려주는 재테크 필독서.",thumbnail:OL+"9788929701200-M.jpg"},
    {id:"p67",title:"유혹하는 글쓰기",authors:"스티븐 킹",publishedDate:"2000",categories:["자기계발"],description:"스릴러 거장 스티븐 킹이 직접 쓴 글쓰기의 모든 것.",thumbnail:OL+"9788987050362-M.jpg"},
    {id:"p68",title:"몰입",authors:"미하이 칙센트미하이",publishedDate:"1990",categories:["심리","자기계발"],description:"완전히 빠져드는 경험 '몰입(Flow)'의 조건과 행복의 심리학.",thumbnail:OL+"9788971900482-M.jpg"},
    {id:"p69",title:"생각에 관한 생각",authors:"대니얼 카너먼",publishedDate:"2011",categories:["심리","과학"],description:"인간의 두 가지 사고 시스템과 인지 편향을 탁월하게 분석한 행동경제학 명저.",thumbnail:OL+"9788934970354-M.jpg"},
    {id:"p70",title:"넛지",authors:"리처드 세일러, 캐스 선스타인",publishedDate:"2008",categories:["심리","경제"],description:"부드러운 개입으로 사람들의 선택을 개선하는 넛지 이론.",thumbnail:OL+"9788984071964-M.jpg"},
    /* ── 과학 ── */
    {id:"p71",title:"코스모스",authors:"칼 세이건",publishedDate:"1980",categories:["과학"],description:"우주의 기원부터 생명의 진화까지 장대한 우주의 역사를 담은 과학 고전.",thumbnail:OL+"9788983711892-M.jpg"},
    {id:"p72",title:"이기적 유전자",authors:"리처드 도킨스",publishedDate:"1976",categories:["과학"],description:"유전자의 관점에서 생명의 진화를 설명하는 진화생물학의 고전.",thumbnail:OL+"9788932459189-M.jpg"},
    {id:"p73",title:"짧고 쉽게 쓴 시간의 역사",authors:"스티븐 호킹",publishedDate:"1988",categories:["과학"],description:"블랙홀, 빅뱅, 시간의 화살 등 우주의 본질을 쉽게 설명한 과학서.",thumbnail:OL+"9788983717108-M.jpg"},
    {id:"p74",title:"페르마의 마지막 정리",authors:"사이먼 싱",publishedDate:"1997",categories:["과학","수학"],description:"358년간 미해결로 남았던 수학 난제가 풀리기까지의 흥미진진한 이야기.",thumbnail:OL+"9788983710857-M.jpg"},
    {id:"p75",title:"총균쇠 2",authors:"재레드 다이아몬드",publishedDate:"1997",categories:["과학","역사"],description:"문명의 붕괴 원인을 생태학적으로 분석한 재레드 다이아몬드의 속편.",thumbnail:OL+"9788937460999-M.jpg"},
    {id:"p76",title:"만들어진 신",authors:"리처드 도킨스",publishedDate:"2006",categories:["과학","철학"],description:"종교의 허구성을 과학적 증거로 논박하는 도킨스의 도전적인 저작.",thumbnail:OL+"9788932458687-M.jpg"},
    {id:"p77",title:"파인만의 여섯 가지 물리 이야기",authors:"리처드 파인만",publishedDate:"1994",categories:["과학"],description:"노벨물리학상 수상자 파인만이 일반인을 위해 강의한 물리학 입문서.",thumbnail:OL+"9788983711496-M.jpg"},
    {id:"p78",title:"엔드 오브 타임",authors:"브라이언 그린",publishedDate:"2020",categories:["과학"],description:"우주의 시작과 끝, 그리고 생명과 의식의 의미를 탐구하는 현대 물리학서.",thumbnail:OL+"9791160028164-M.jpg"},
    {id:"p79",title:"뇌의 배신",authors:"로버트 버튼",publishedDate:"2008",categories:["과학","심리"],description:"뇌가 우리를 어떻게 속이는지를 신경과학으로 풀어낸 책.",thumbnail:OL+"9788986361698-M.jpg"},
    {id:"p80",title:"왜 세계의 절반은 굶주리는가",authors:"장 지글러",publishedDate:"1999",categories:["사회","과학"],description:"세계 기아 문제의 구조적 원인을 아버지와 아들의 대화로 풀어낸 책.",thumbnail:OL+"9788984940963-M.jpg"},
    /* ── 역사/사회 ── */
    {id:"p81",title:"군중심리",authors:"귀스타브 르봉",publishedDate:"1895",categories:["심리","사회"],description:"군중의 심리와 행동 원리를 분석한 사회심리학의 고전.",thumbnail:OL+"9788934975403-M.jpg"},
    {id:"p82",title:"설득의 심리학",authors:"로버트 치알디니",publishedDate:"1984",categories:["심리","자기계발"],description:"인간을 설득하는 6가지 원칙을 사례와 함께 설명한 심리학 베스트셀러.",thumbnail:OL+"9788959134212-M.jpg"},
    {id:"p83",title:"총 균 쇠 (개정판)",authors:"재레드 다이아몬드",publishedDate:"2005",categories:["역사"],description:"인류 문명의 불균형 발전을 설명하는 환경결정론의 결정판.",thumbnail:OL+"9788937460999-M.jpg"},
    {id:"p84",title:"역사란 무엇인가",authors:"E. H. 카",publishedDate:"1961",categories:["역사","인문"],description:"역사와 역사가의 관계, 역사적 진실이란 무엇인지를 탐구한 역사철학 명저.",thumbnail:OL+"9788934975007-M.jpg"},
    {id:"p85",title:"대항해시대",authors:"주경철",publishedDate:"2008",categories:["역사"],description:"15~17세기 포르투갈과 스페인의 탐험이 세계를 어떻게 바꾸었는지를 서술한 역사서.",thumbnail:OL+"9788996093053-M.jpg"},
    {id:"p86",title:"오래된 미래",authors:"헬레나 노르베리-호지",publishedDate:"1991",categories:["사회","환경"],description:"인도 라다크 문명을 통해 현대 문명의 문제점을 성찰하는 책.",thumbnail:OL+"9788985989299-M.jpg"},
    {id:"p87",title:"침묵의 봄",authors:"레이철 카슨",publishedDate:"1962",categories:["환경","과학"],description:"살충제 남용이 생태계에 미치는 영향을 경고하며 환경운동을 촉발한 명저.",thumbnail:OL+"9788937460999-M.jpg"},
    {id:"p88",title:"작은 것이 아름답다",authors:"E. F. 슈마허",publishedDate:"1973",categories:["경제","사회"],description:"인간 중심의 소규모 경제를 제안한 대안 경제학의 고전.",thumbnail:OL+"9788984940079-M.jpg"},
    {id:"p89",title:"월든",authors:"헨리 데이비드 소로",publishedDate:"1854",categories:["에세이","철학"],description:"숲 속 오두막에서 2년간 자급자족하며 단순한 삶을 실험한 소로의 기록.",thumbnail:OL+"9788937460142-M.jpg"},
    {id:"p90",title:"자본론 1",authors:"카를 마르크스",publishedDate:"1867",categories:["경제","철학"],description:"자본주의 경제의 구조와 모순을 분석한 사상사 최대의 문제작.",thumbnail:OL+"9788993537048-M.jpg"},
    /* ── 세계 베스트셀러 ── */
    {id:"p91",title:"해리 포터와 마법사의 돌",authors:"J.K. 롤링",publishedDate:"1997",categories:["판타지","소설"],description:"마법사 학교 호그와트에서 펼쳐지는 해리 포터의 첫 번째 모험.",thumbnail:OL+"9788983920317-M.jpg"},
    {id:"p92",title:"반지의 제왕",authors:"J.R.R. 톨킨",publishedDate:"1954",categories:["판타지","소설"],description:"절대 반지를 둘러싼 선과 악의 거대한 전쟁을 그린 판타지 문학의 원점.",thumbnail:OL+"9788937460555-M.jpg"},
    {id:"p93",title:"다빈치 코드",authors:"댄 브라운",publishedDate:"2003",categories:["추리","소설"],description:"레오나르도 다빈치의 작품에 숨겨진 기독교 역사의 비밀을 추적하는 스릴러.",thumbnail:OL+"9788937460616-M.jpg"},
    {id:"p94",title:"파우스트",authors:"요한 볼프강 폰 괴테",publishedDate:"1808",categories:["고전","희곡"],description:"인간의 욕망과 구원을 악마와의 계약으로 탐구한 독일 문학의 최고봉.",thumbnail:OL+"9788937460197-M.jpg"},
    {id:"p95",title:"돈키호테",authors:"미겔 데 세르반테스",publishedDate:"1605",categories:["고전","소설"],description:"기사소설에 빠진 라만차의 귀족 돈키호테의 우스꽝스럽고도 감동적인 모험.",thumbnail:OL+"9788937460227-M.jpg"},
    {id:"p96",title:"신곡",authors:"단테 알리기에리",publishedDate:"1320",categories:["고전","시"],description:"지옥·연옥·천국을 여행하며 인간의 죄와 구원을 노래한 이탈리아 문학의 최고작.",thumbnail:OL+"9788937460197-M.jpg"},
    {id:"p97",title:"일리아스",authors:"호메로스",publishedDate:"-750",categories:["고전","시"],description:"트로이 전쟁 마지막 해를 배경으로 아킬레우스의 분노를 노래한 서사시.",thumbnail:OL+"9788937460159-M.jpg"},
    {id:"p98",title:"오디세이아",authors:"호메로스",publishedDate:"-750",categories:["고전","시"],description:"트로이 전쟁 후 고향 이타카로 돌아가는 오디세우스의 10년 여정.",thumbnail:OL+"9788937460166-M.jpg"},
    {id:"p99",title:"앵무새 죽이기",authors:"하퍼 리",publishedDate:"1960",categories:["소설"],description:"인종차별이 심한 미국 남부를 배경으로 한 소녀의 눈으로 본 정의와 양심의 이야기.",thumbnail:OL+"9788937460586-M.jpg"},
    {id:"p100",title:"파친코",authors:"이민진",publishedDate:"2017",categories:["소설"],description:"일제강점기부터 1980년대까지 재일조선인 4대 가족의 삶을 그린 장편소설.",thumbnail:OL+"9788996984863-M.jpg"},
  ];

  function loadDefaultBooks() {
    /* API 호출 없이 바로 렌더링 */
    var sum=$id("search-results-summary");
    var grid=$id("search-results-grid");
    var wrap=$id("load-more-wrap");
    if(!grid) return;

    grid.innerHTML="";
    if(wrap) wrap.style.display="none";

    PRESET_BOOKS.forEach(function(b){ state.booksCache[b.id]=b; });
    appendCards(PRESET_BOOKS, false);

    if(sum){
      sum.textContent="라 리브레리 추천 도서 "+PRESET_BOOKS.length+"권";
      sum.style.display="block";
    }
  }
/* ==========================
   고급 검색 및 추천 시스템
   ========================== */

// 책에 키워드 자동 생성
function enrichBookData(book) {
  if (!book.keywords) {
    book.keywords = [];
  }

  // 장르를 키워드에 추가
  if (Array.isArray(book.categories)) {
    book.keywords.push(...book.categories);
  }

  // 설명에서 자주 쓰이는 단어 추출
  if (book.description) {
    const words = book.description
      .toLowerCase()
      .replace(/[^\w\s가-힣]/g, "")
      .split(/\s+/)
      .filter(word => word.length >= 2);

    book.keywords.push(...words);
  }

  // 중복 제거
  book.keywords = [...new Set(book.keywords)];

  return book;
}


// 제목 + 작가 + 장르 + 설명 + 키워드 검색
function advancedSearch(books, query) {
  const q = query.trim().toLowerCase();

  return books.filter(book => {

    const title =
      (book.title || "").toLowerCase();

    const authors =
      Array.isArray(book.authors)
        ? book.authors.join(" ").toLowerCase()
        : "";

    const categories =
      Array.isArray(book.categories)
        ? book.categories.join(" ").toLowerCase()
        : "";

    const description =
      (book.description || "").toLowerCase();

    const keywords =
      Array.isArray(book.keywords)
        ? book.keywords.join(" ").toLowerCase()
        : "";

    return (
      title.includes(q) ||
      authors.includes(q) ||
      categories.includes(q) ||
      description.includes(q) ||
      keywords.includes(q)
    );
  });
}


// 비슷한 책 추천
function recommendBooks(selectedBook, allBooks, limit = 6) {

  const selectedCategories =
    selectedBook.categories || [];

  const selectedKeywords =
    selectedBook.keywords || [];

  const recommendations = allBooks
    .filter(book => book.id !== selectedBook.id)
    .map(book => {

      let score = 0;

      // 같은 장르면 높은 점수
      if (book.categories) {
        book.categories.forEach(category => {
          if (selectedCategories.includes(category)) {
            score += 10;
          }
        });
      }

      // 키워드가 겹치면 점수 추가
      if (book.keywords) {
        book.keywords.forEach(keyword => {
          if (selectedKeywords.includes(keyword)) {
            score += 1;
          }
        });
      }

      return {
        ...book,
        score
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return recommendations;
}


// 전체 책 데이터 전처리
function prepareBooks(books) {
  return books.map(enrichBookData);
}
  /* ==========================================================
   * 11. 초기화
   * ======================================================== */
  document.addEventListener("DOMContentLoaded", function(){
    loadDefaultBooks();       /* 검색 그리드에 100권 즉시 삽입 */
    window.navigateTo("home"); /* 홈 화면 표시 */
  });
})();

