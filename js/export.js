/**
 * CloudFrame — Export Module
 * PDF / 圖片 / 簡報匯出功能
 *
 * 依賴（CDN 載入）：
 *   jsPDF:       https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js
 *   html2canvas: https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js
 */

(function(global) {
  'use strict';

  // ── 載入狀態 ────────────────────────────────────────────────
  function isReady() {
    return typeof window.jspdf !== 'undefined' && typeof window.html2canvas !== 'undefined';
  }

  async function ensureLibs() {
    if (isReady()) return true;
    // 動態載入
    await Promise.all([
      _loadScript('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js'),
      _loadScript('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js'),
    ]);
    return isReady();
  }

  function _loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  // ── 主要匯出函式 ───────────────────────────────────────────

  /**
   * 匯出結果區塊為 PDF
   * @param {string} containerId - 要截圖的 DOM 元素 id
   * @param {string} fileName    - 下載檔名（不含副檔名）
   */
  async function exportPDF(containerId = 'resultContainer', fileName = 'Smart-Archie-Report') {
    if (typeof SA !== 'undefined') SA.Loading.show('產生 PDF 中…', '正在截圖並轉換為 PDF 格式');

    try {
      const ready = await ensureLibs();
      if (!ready) throw new Error('PDF 函式庫載入失敗');

      const el = document.getElementById(containerId);
      if (!el) throw new Error('找不到報告容器');

      // 截圖
      const canvas = await window.html2canvas(el, {
        scale:           2,
        useCORS:         true,
        allowTaint:      true,
        backgroundColor: '#F5F7FA',
        logging:         false,
        windowWidth:     1200,
      });

      const { jsPDF } = window.jspdf;
      const pdf    = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW  = pdf.internal.pageSize.getWidth();
      const pageH  = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const imgW   = pageW - margin * 2;
      const imgH   = (canvas.height * imgW) / canvas.width;

      // 封面頁
      _addPDFCover(pdf, pageW, pageH, fileName);
      pdf.addPage();

      // 內容（分頁）
      let yOffset = 0;
      while (yOffset < imgH) {
        const sliceH = Math.min(pageH - margin * 2, imgH - yOffset);
        const srcY   = (yOffset / imgH) * canvas.height;
        const srcH   = (sliceH / imgH) * canvas.height;

        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width  = canvas.width;
        sliceCanvas.height = srcH;
        sliceCanvas.getContext('2d').drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);

        const imgData = sliceCanvas.toDataURL('image/png');
        pdf.addImage(imgData, 'PNG', margin, margin, imgW, sliceH);

        yOffset += sliceH;
        if (yOffset < imgH) pdf.addPage();
      }

      // 頁尾頁碼
      const totalPages = pdf.internal.getNumberOfPages();
      for (let i = 2; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setTextColor(150, 150, 150);
        pdf.text(
          `CloudFrame AI Cloud Advisory — 第 ${i - 1} / ${totalPages - 1} 頁`,
          pageW / 2, pageH - 5, { align: 'center' }
        );
      }

      pdf.save(`${fileName}.pdf`);

      if (typeof SA_Analytics !== 'undefined') SA_Analytics.track('Report Exported', { format: 'pdf' });
      if (typeof SA !== 'undefined') SA.Toast.success('PDF 匯出成功', '檔案已下載至您的電腦');

    } catch (err) {
      console.error('[Export] PDF error:', err);
      if (typeof SA !== 'undefined') SA.Toast.error('PDF 匯出失敗', err.message);
    } finally {
      if (typeof SA !== 'undefined') SA.Loading.hide();
    }
  }

  function _addPDFCover(pdf, pageW, pageH, title) {
    // 深藍背景
    pdf.setFillColor(15, 43, 61);
    pdf.rect(0, 0, pageW, pageH, 'F');

    // Teal 裝飾圓
    pdf.setFillColor(26, 155, 181);
    pdf.circle(pageW - 20, 20, 40, 'F');
    pdf.setFillColor(201, 168, 76, 0.3);
    pdf.circle(20, pageH - 20, 30, 'F');

    // Logo 方塊
    pdf.setFillColor(26, 155, 181);
    pdf.roundedRect(pageW / 2 - 15, pageH * 0.25, 30, 30, 4, 4, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(20);
    pdf.setFont('helvetica', 'bold');
    pdf.text('A', pageW / 2, pageH * 0.25 + 20, { align: 'center' });

    // 標題
    pdf.setFontSize(22);
    pdf.setTextColor(255, 255, 255);
    pdf.text('CloudFrame', pageW / 2, pageH * 0.42, { align: 'center' });

    pdf.setFontSize(12);
    pdf.setTextColor(201, 168, 76);
    pdf.text('AI Cloud Strategy Advisor', pageW / 2, pageH * 0.42 + 9, { align: 'center' });

    // 報告標題
    pdf.setFontSize(14);
    pdf.setTextColor(255, 255, 255);
    const cleanTitle = (title || '雲端分析報告').replace(/Smart-Archie-/, '').replace(/-/g, ' ');
    pdf.text(cleanTitle, pageW / 2, pageH * 0.58, { align: 'center' });

    // 日期
    pdf.setFontSize(9);
    pdf.setTextColor(150, 180, 200);
    pdf.text(new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' }),
      pageW / 2, pageH * 0.65, { align: 'center' });

    // 底部
    pdf.setFontSize(8);
    pdf.setTextColor(100, 130, 150);
    pdf.text('© 2026 CloudFrame · AI Cloud Advisory · Confidential', pageW / 2, pageH - 10, { align: 'center' });
  }

  /**
   * 截圖匯出為 PNG 圖片
   */
  async function exportImage(containerId = 'resultContainer', fileName = 'Smart-Archie-Report') {
    if (typeof SA !== 'undefined') SA.Loading.show('產生圖片中…', '');
    try {
      await ensureLibs();
      const el = document.getElementById(containerId);
      if (!el) throw new Error('找不到報告容器');
      const canvas = await window.html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#F5F7FA' });
      const link   = document.createElement('a');
      link.download = `${fileName}.png`;
      link.href     = canvas.toDataURL('image/png');
      link.click();
      if (typeof SA !== 'undefined') SA.Toast.success('圖片匯出成功');
    } catch (err) {
      if (typeof SA !== 'undefined') SA.Toast.error('匯出失敗', err.message);
    } finally {
      if (typeof SA !== 'undefined') SA.Loading.hide();
    }
  }

  /**
   * 複製報告摘要至剪貼簿（Markdown 格式）
   */
  async function copyMarkdown(result) {
    if (!result) { if (typeof SA !== 'undefined') SA.Toast.warning('請先執行分析'); return; }

    const r = result;
    const stratLabels = { rehost:'直接遷移 (Rehost)', replatform:'平台調整 (Replatform)', refactor:'架構重構 (Refactor)', retain:'暫緩保留 (Retain)', retire:'下線退場 (Retire)' };

    const md = [
      `# CloudFrame 雲端分析報告`,
      `> 專案：${r.inputs?.projectName || 'Untitled'} | 分析時間：${new Date(r.timestamp || Date.now()).toLocaleDateString('zh-TW')}`,
      '',
      `## 建議策略`,
      `**${stratLabels[r.strategy6R?.primary] || r.strategy6R?.primary || ''}**（信心指數 ${r.strategy6R?.confidence || 0}%）`,
      '',
      `## KPI 分數`,
      `| 指標 | 分數 |`,
      `|---|---|`,
      `| 合規就緒度 | ${r.kpi?.compliance || 0}% |`,
      `| LZ 就緒度 | ${r.kpi?.lzReadiness || 0}% |`,
      `| 技術債評分 | ${r.kpi?.techDebt || 0}% |`,
      `| ROI 潛力 | ${r.kpi?.roi || 0}% |`,
      `| 時程可行度 | ${r.kpi?.timeline || 0}% |`,
      '',
      `## 風險概況`,
      `整體風險：${r.riskRadar?.overall || 0}%`,
      '',
      `## 成本估算`,
      `月費：USD $${(r.costEstimate?.mid || 0).toLocaleString()}（建議方案）`,
      '',
      `---`,
      `*由 CloudFrame AI 雲端顧問平台生成 · https://unique-jelly-da79b4.netlify.app*`,
    ].join('\n');

    try {
      await navigator.clipboard.writeText(md);
      if (typeof SA !== 'undefined') SA.Toast.success('已複製 Markdown', '可貼入 Notion、Confluence 等工具');
    } catch {
      if (typeof SA !== 'undefined') SA.Toast.error('複製失敗', '請手動選取內容複製');
    }
  }

  // ── Public API ─────────────────────────────────────────────
  global.SAExport = { exportPDF, exportImage, copyMarkdown, ensureLibs };

})(typeof window !== 'undefined' ? window : globalThis);
