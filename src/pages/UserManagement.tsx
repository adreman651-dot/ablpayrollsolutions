import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Users, UserCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

export default function UserManagement() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    try {
      // Fetch users roles
      const { data: rolesData, error: rolesErr } = await supabase.from('user_roles').select('*');
      if (rolesErr) throw rolesErr;

      // Fetch profiles
      const { data: profilesData, error: profilesErr } = await supabase.from('profiles').select('*');
      if (profilesErr) throw profilesErr;

      const merged = profilesData.map((profile: any) => {
        const userRoleObj = rolesData?.find((r: any) => r.user_id === profile.id);
        return {
          id: profile.id,
          full_name: profile.full_name || 'Anonymous User',
          email: profile.email || 'No email registered',
          role: userRoleObj ? userRoleObj.role : 'employee',
        };
      });

      setUsers(merged);
    } catch (e: any) {
      console.error(e);
      toast.error("Failed to load user management details: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleRoleChange = async (userId: string, newRole: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.from('user_roles').upsert({
        user_id: userId,
        role: newRole as any,
      }, { onConflict: 'user_id' });

      if (error) throw error;
      toast.success("User role updated successfully.");
      await fetchUsers();
    } catch (e: any) {
      toast.error("Failed to update role: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white font-display">User Management</h1>
        <p className="text-muted-foreground">Manage administrative dashboard accounts, user login records, and role permissions</p>
      </div>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Registered Portal Accounts
          </CardTitle>
          <CardDescription>Assign security clearances to registered employees and administrators</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Full Name</TableHead>
                <TableHead>Account Email</TableHead>
                <TableHead>Security Role</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Loading accounts...</TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No portal accounts found.</TableCell>
                </TableRow>
              ) : (
                users.map(u => (
                  <TableRow key={u.id}>
                    <TableCell className="font-semibold text-white">{u.full_name}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>
                      <span className="capitalize text-xs font-bold bg-primary/10 text-primary border border-primary/20 px-2.5 py-1 rounded-full">
                        {u.role}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-block min-w-36 text-left">
                        <Select value={u.role} onValueChange={(val) => handleRoleChange(u.id, val)}>
                          <SelectTrigger className="bg-slate-900 border-border">
                            <SelectValue placeholder="Change Role" />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-900 border-border text-white">
                            <SelectItem value="admin">Administrator</SelectItem>
                            <SelectItem value="manager">Manager</SelectItem>
                            <SelectItem value="employee">Employee</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
