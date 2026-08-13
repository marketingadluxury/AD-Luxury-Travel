import express from 'express';
import { getAdminSupabaseClient } from '../services/supabaseService.js';

const router = express.Router();

// Admin API: Delete user profile
router.delete(['/admin/delete-user', '/api/admin/delete-user'], async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      res.status(400).json({ error: 'Thiếu ID người dùng cần xóa' });
      return;
    }

    const supabaseAdmin = getAdminSupabaseClient(req);

    // Delete profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (profileError) {
      console.error('[Admin API] Lỗi khi xóa profile:', profileError);
      res.status(500).json({ error: 'Không thể xóa hồ sơ người dùng: ' + profileError.message });
      return;
    }

    // Delete auth user if service role key available
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
        if (authError) {
          console.warn('[Admin API] Cảnh báo khi xóa Auth User:', authError.message);
        }
      } catch (authErr: any) {
        console.warn('[Admin API] Không thể xóa Auth User trong Supabase Auth:', authErr.message || authErr);
      }
    }

    res.json({ success: true, message: 'Đã xóa người dùng thành công' });
  } catch (error: any) {
    console.error('Lỗi API /api/admin/delete-user:', error);
    res.status(500).json({ error: error.message || 'Lỗi hệ thống khi xóa người dùng' });
  }
});

// Admin API: Toggle active status
router.post(['/admin/toggle-active', '/api/admin/toggle-active'], async (req, res) => {
  try {
    const { userId, isActive } = req.body;
    if (!userId || typeof isActive !== 'boolean') {
      res.status(400).json({ error: 'Thiếu thông tin người dùng hoặc trạng thái mới' });
      return;
    }

    const supabaseAdmin = getAdminSupabaseClient(req);

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ is_active: isActive })
      .eq('id', userId);

    if (profileError) {
      console.error('[Admin API] Lỗi khi cập nhật is_active profile:', profileError);
      res.status(500).json({ error: 'Không thể cập nhật trạng thái: ' + profileError.message });
      return;
    }

    res.json({ success: true, message: 'Cập nhật trạng thái người dùng thành công' });
  } catch (error: any) {
    console.error('Lỗi API /api/admin/toggle-active:', error);
    res.status(500).json({ error: error.message || 'Lỗi hệ thống khi cập nhật trạng thái' });
  }
});

// Teams API
router.get(['/teams', '/api/teams'], async (req, res) => {
  try {
    const supabaseAdmin = getAdminSupabaseClient(req);
    const { data: teams, error: teamsError } = await supabaseAdmin
      .from('teams')
      .select('*')
      .order('name');

    if (teamsError) {
      console.error('[Teams API] Lỗi khi lấy danh sách nhóm:', teamsError);
      res.status(500).json({ error: teamsError.message });
      return;
    }

    res.json({ teams: teams || [] });
  } catch (error: any) {
    console.error('[Teams API] Lỗi hệ thống:', error);
    res.status(500).json({ error: error.message || 'Lỗi server' });
  }
});

router.post(['/teams', '/api/teams'], async (req, res) => {
  try {
    const { name, leader_id, description, member_ids } = req.body;
    if (!name || !name.trim()) {
      res.status(400).json({ error: 'Tên nhóm không được để trống' });
      return;
    }

    const supabaseAdmin = getAdminSupabaseClient(req);

    const { data: team, error: teamError } = await supabaseAdmin
      .from('teams')
      .insert({
        name: name.trim(),
        leader_id: leader_id || null,
        description: description || null
      })
      .select()
      .single();

    if (teamError) {
      console.error('[Teams API] Lỗi khi tạo nhóm mới:', teamError);
      res.status(500).json({ error: teamError.message });
      return;
    }

    if (member_ids && Array.isArray(member_ids) && member_ids.length > 0) {
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({ team_id: team.id })
        .in('id', member_ids);

      if (updateError) {
        console.warn('[Teams API] Cảnh báo khi gán thành viên vào nhóm:', updateError.message);
      }
    }

    res.json({ success: true, team });
  } catch (error: any) {
    console.error('[Teams API] Lỗi hệ thống khi tạo nhóm:', error);
    res.status(500).json({ error: error.message || 'Lỗi server' });
  }
});

router.put(['/teams/:id', '/api/teams/:id'], async (req, res) => {
  try {
    const { id } = req.params;
    const { name, leader_id, description, member_ids } = req.body;

    if (!id) {
      res.status(400).json({ error: 'Thiếu ID nhóm' });
      return;
    }

    const supabaseAdmin = getAdminSupabaseClient(req);

    const updateData: any = {};
    if (name !== undefined) updateData.name = name.trim();
    if (leader_id !== undefined) updateData.leader_id = leader_id || null;
    if (description !== undefined) updateData.description = description || null;

    const { data: team, error: teamError } = await supabaseAdmin
      .from('teams')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (teamError) {
      console.error('[Teams API] Lỗi khi cập nhật nhóm:', teamError);
      res.status(500).json({ error: teamError.message });
      return;
    }

    if (member_ids && Array.isArray(member_ids)) {
      await supabaseAdmin
        .from('profiles')
        .update({ team_id: null })
        .eq('team_id', id);

      if (member_ids.length > 0) {
        await supabaseAdmin
          .from('profiles')
          .update({ team_id: id })
          .in('id', member_ids);
      }
    }

    res.json({ success: true, team });
  } catch (error: any) {
    console.error('[Teams API] Lỗi hệ thống khi cập nhật nhóm:', error);
    res.status(500).json({ error: error.message || 'Lỗi server' });
  }
});

router.delete(['/teams/:id', '/api/teams/:id'], async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: 'Thiếu ID nhóm' });
      return;
    }

    const supabaseAdmin = getAdminSupabaseClient(req);

    await supabaseAdmin
      .from('profiles')
      .update({ team_id: null })
      .eq('team_id', id);

    const { error: deleteError } = await supabaseAdmin
      .from('teams')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('[Teams API] Lỗi khi xóa nhóm:', deleteError);
      res.status(500).json({ error: deleteError.message });
      return;
    }

    res.json({ success: true, message: 'Đã xóa nhóm thành công' });
  } catch (error: any) {
    console.error('[Teams API] Lỗi hệ thống khi xóa nhóm:', error);
    res.status(500).json({ error: error.message || 'Lỗi server' });
  }
});

export default router;
