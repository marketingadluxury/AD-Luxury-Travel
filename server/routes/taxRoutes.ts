import express from 'express';

const router = express.Router();

const MCP_ENDPOINT = 'https://go.noti.vn/api/skill-mcp/0dc7dc9b8ee401b1/smk_d8600194_4c27c8c2e50b21594af3d60e4e77021542f7aa446c3e4f2b';
const CURRENT_LOCAL_VERSION = 'v2.2.0';
const CURRENT_LOCAL_DATE = '06/09/2026';

// Check MCP Skill Update
router.all(['/api/tax/check-mcp-update', '/tax/check-mcp-update'], async (req, res) => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const mcpResponse = await fetch(MCP_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: {
          name: 'list_skills',
          arguments: {}
        }
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!mcpResponse.ok) {
      res.status(502).json({
        success: false,
        error: `Máy chủ MCP phản hồi mã lỗi ${mcpResponse.status}`,
        currentVersion: CURRENT_LOCAL_VERSION,
        currentDate: CURRENT_LOCAL_DATE
      });
      return;
    }

    const mcpData = await mcpResponse.json();
    const content = mcpData?.result?.content?.[0]?.text;
    let skillInfo = null;

    if (content) {
      try {
        const skillsList = JSON.parse(content);
        skillInfo = Array.isArray(skillsList) ? skillsList.find((s: any) => s.name === 'thue-vietnam') : null;
      } catch (e) {
        console.warn('[Tax Route] Không parse được danh sách skill:', e);
      }
    }

    const updatedAt = skillInfo?.updatedAt ? new Date(skillInfo.updatedAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : CURRENT_LOCAL_DATE;

    res.json({
      success: true,
      serverStatus: 'online',
      currentVersion: CURRENT_LOCAL_VERSION,
      latestVersion: CURRENT_LOCAL_VERSION,
      updatedAt: updatedAt,
      rawUpdatedAt: skillInfo?.updatedAt || null,
      hasUpdate: false,
      message: 'Hệ thống đang sử dụng phiên bản quy chuẩn thuế mới nhất từ MCP Server.',
      skillName: 'thue-vietnam',
      description: skillInfo?.description || 'Quy chuẩn thuế Việt Nam 2025 - 2026'
    });
  } catch (error: any) {
    console.error('[Tax Route] Lỗi kiểm tra cập nhật MCP:', error?.message);
    res.json({
      success: true,
      serverStatus: 'cached',
      currentVersion: CURRENT_LOCAL_VERSION,
      latestVersion: CURRENT_LOCAL_VERSION,
      updatedAt: CURRENT_LOCAL_DATE,
      hasUpdate: false,
      message: 'Đang sử dụng dữ liệu quy chuẩn cục bộ (kết nối MCP tạm thời bận).',
      error: error?.message
    });
  }
});

export default router;
