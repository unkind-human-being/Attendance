import { useState, useEffect } from "react";
import SidebarLayout from "../../components/SidebarLayout";
import { db, auth, firebaseConfig } from "../../firebase/firebase";
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, setDoc, query, where } from "firebase/firestore";
import { initializeApp, getApps } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signOut } from "firebase/auth";

const EyeOpenIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeClosedIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

export default function AdminHome() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeView, setActiveView] = useState("create-room");
  const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false);

  const [users, setUsers] = useState([]);
  const [rooms, setRooms] = useState([]);

  const [feedback, setFeedback] = useState({ text: "", type: "", show: false });

  const [formData, setFormData] = useState({
    firstName: "", middleInitial: "", lastName: "", email: "", password: "", assignedRoom: "", studentLRN: "", studentFirstName: "", studentLastName: ""
  });

  // Password visibility toggles
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);

  const [roomForm, setRoomForm] = useState({ grade: "1", section: "", assignedTeacherId: "" });

  // Room Edit States
  const [editingRoomId, setEditingRoomId] = useState(null);
  const [editTeacherId, setEditTeacherId] = useState("");

  // User Edit States (Room + Real Firebase Password)
  const [editingUser, setEditingUser] = useState(null);
  const [newRoomAssignment, setNewRoomAssignment] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [savingUserEdit, setSavingUserEdit] = useState(false);

  const [roleFilter, setRoleFilter] = useState("teacher");
  const [gradeFilter, setGradeFilter] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const showMessage = (text, type = "success") => {
    setFeedback({ text, type, show: true });
    setTimeout(() => setFeedback({ text: "", type: "", show: false }), 3500);
  };

  useEffect(() => {
    fetchUsers();
    fetchRooms();
  }, []);

  const fetchUsers = async () => {
    const querySnapshot = await getDocs(collection(db, "users"));
    const loadedUsers = [];
    querySnapshot.forEach((document) => loadedUsers.push({ id: document.id, ...document.data() }));
    setUsers(loadedUsers);
  };

  const fetchRooms = async () => {
    const querySnapshot = await getDocs(collection(db, "rooms"));
    const loadedRooms = [];
    querySnapshot.forEach((document) => loadedRooms.push({ id: document.id, ...document.data() }));
    loadedRooms.sort((a, b) => a.grade - b.grade);
    setRooms(loadedRooms);
  };

  // --- STRICT 1-TEACHER-PER-ROOM HELPERS ---
  const assignedTeacherIds = new Set(rooms.map((r) => r.assignedTeacherId).filter(Boolean));

  const isTeacherAssigned = (teacher) => {
    return Boolean(teacher.assignedRoom && teacher.assignedRoom.trim() !== "") || assignedTeacherIds.has(teacher.id);
  };

  const getUnassignedTeachers = (includeTeacherId = "") => {
    return users
      .filter((u) => u.role === "teacher" && (!isTeacherAssigned(u) || u.id === includeTeacherId))
      .sort((a, b) => (a.lastName || "").localeCompare(b.lastName || ""));
  };

  const handleUserChange = (e) => {
    let { name, value } = e.target;
    if (name === "middleInitial") value = value.toUpperCase().slice(0, 1);
    if (name === "studentLRN") value = value.replace(/\D/g, "").slice(0, 12);
    setFormData({ ...formData, [name]: value });
  };

  const handleCreateUser = async (e, role) => {
    e.preventDefault();
    try {
      const existingSecondary = getApps().find((a) => a.name === "SecondaryApp");
      const secondaryApp = existingSecondary || initializeApp(firebaseConfig, "SecondaryApp");
      const secondaryAuth = getAuth(secondaryApp);

      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, formData.email, formData.password);
      const newUserId = userCredential.user.uid;

      const formattedMI = formData.middleInitial ? `${formData.middleInitial}.` : "";
      const fullName = `${formData.firstName} ${formattedMI} ${formData.lastName}`.replace(/\s+/g, " ").trim();

      const userData = {
        fullName, firstName: formData.firstName, middleInitial: formData.middleInitial, lastName: formData.lastName,
        email: formData.email, role: role, assignedRoom: role === "teacher" ? "" : formData.assignedRoom,
        ...(role === "parent" && { studentLRN: formData.studentLRN, studentName: `${formData.studentFirstName} ${formData.studentLastName}` })
      };

      await setDoc(doc(db, "users", newUserId), userData);

      if (role === "parent") {
        const studentData = {
          firstName: formData.studentFirstName, lastName: formData.studentLastName,
          fullName: `${formData.studentFirstName} ${formData.studentLastName}`.trim(),
          lrn: formData.studentLRN, room: formData.assignedRoom, parentUid: newUserId
        };
        await addDoc(collection(db, "students"), studentData);
      }

      await signOut(secondaryAuth);
      showMessage(`${role.charAt(0).toUpperCase() + role.slice(1)} account created successfully!`);
      setFormData({ firstName: "", middleInitial: "", lastName: "", email: "", password: "", assignedRoom: "", studentLRN: "", studentFirstName: "", studentLastName: "" });
      setShowCreatePassword(false);
      fetchUsers();
    } catch (error) {
      showMessage(error.message || "Error creating user.", "error");
    }
  };

  // --- EDIT USER (ROOM + REAL FIREBASE AUTH PASSWORD) ---
  const handleUpdateUser = async (e) => {
    e.preventDefault();
    if (!editingUser) return;

    if (newUserPassword && newUserPassword.length < 6) {
      showMessage("New password must be at least 6 characters.", "error");
      return;
    }

    setSavingUserEdit(true);
    try {
      // 1. Update real Firebase Auth password if entered
      if (newUserPassword.trim() !== "") {
        const currentAdmin = auth.currentUser;
        if (!currentAdmin) throw new Error("Admin session expired. Please log in again.");

        const idToken = await currentAdmin.getIdToken();
        const res = await fetch("/api/update-password", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            uid: editingUser.id,
            newPassword: newUserPassword.trim(),
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to update password in Firebase.");
        }
      }

      // 2. Update assigned room if selected/changed
      if (newRoomAssignment && newRoomAssignment !== editingUser.assignedRoom) {
        if (editingUser.role === "teacher") {
          const targetRoom = rooms.find((r) => `Grade ${r.grade} - ${r.name}` === newRoomAssignment);

          // Enforce strict 1-teacher-per-room rule
          if (targetRoom && targetRoom.assignedTeacherId && targetRoom.assignedTeacherId !== editingUser.id) {
            throw new Error("That room already has an assigned adviser.");
          }

          // Clear teacher from their old room (if they had one)
          const oldRoom = rooms.find((r) => r.assignedTeacherId === editingUser.id);
          if (oldRoom) {
            await updateDoc(doc(db, "rooms", oldRoom.id), {
              assignedTeacherId: "",
              assignedTeacherName: "Unassigned",
            });
          }

          // Assign teacher to the new room
          if (targetRoom) {
            await updateDoc(doc(db, "rooms", targetRoom.id), {
              assignedTeacherId: editingUser.id,
              assignedTeacherName: `${editingUser.firstName} ${editingUser.lastName}`,
            });
          }
        }

        await updateDoc(doc(db, "users", editingUser.id), {
          assignedRoom: newRoomAssignment,
        });

        // Sync linked Student record if Parent
        if (editingUser.role === "parent" && editingUser.studentLRN) {
          const studentQuery = query(collection(db, "students"), where("lrn", "==", editingUser.studentLRN));
          const studentSnapshot = await getDocs(studentQuery);
          for (const studentDoc of studentSnapshot.docs) {
            await updateDoc(doc(db, "students", studentDoc.id), { room: newRoomAssignment });
          }
        }
      }

      showMessage("User updated successfully!");
      setEditingUser(null);
      setNewRoomAssignment("");
      setNewUserPassword("");
      setShowEditPassword(false);
      fetchUsers();
      fetchRooms();
    } catch (err) {
      console.error("Error updating user:", err);
      showMessage(err.message || "Failed to update user.", "error");
    } finally {
      setSavingUserEdit(false);
    }
  };

  const handleDeleteUser = async (userId, name) => {
    if (window.confirm(`Are you sure you want to delete ${name}'s account?`)) {
      try {
        // Free up any room if deleting an assigned teacher
        const teacherRoom = rooms.find((r) => r.assignedTeacherId === userId);
        if (teacherRoom) {
          await updateDoc(doc(db, "rooms", teacherRoom.id), {
            assignedTeacherId: "",
            assignedTeacherName: "Unassigned",
          });
        }

        await deleteDoc(doc(db, "users", userId));
        showMessage("User deleted successfully.");
        fetchUsers();
        fetchRooms();
      } catch (error) {
        showMessage("Failed to delete user.", "error");
      }
    }
  };

  const handleRoomChange = (e) => setRoomForm({ ...roomForm, [e.target.name]: e.target.value });

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    try {
      const assignedTeacher = users.find((u) => u.id === roomForm.assignedTeacherId);

      // Double-check strict 1-teacher-per-room rule
      if (assignedTeacher && isTeacherAssigned(assignedTeacher)) {
        showMessage("This teacher is already assigned to another room.", "error");
        return;
      }

      const teacherName = assignedTeacher ? `${assignedTeacher.firstName} ${assignedTeacher.lastName}` : "Unassigned";
      const newRoomName = `Grade ${roomForm.grade} - ${roomForm.section}`;

      await addDoc(collection(db, "rooms"), {
        grade: roomForm.grade, name: roomForm.section, assignedTeacherId: roomForm.assignedTeacherId || "",
        assignedTeacherName: teacherName, createdBy: "Admin"
      });

      if (roomForm.assignedTeacherId) {
        await updateDoc(doc(db, "users", roomForm.assignedTeacherId), { assignedRoom: newRoomName });
      }

      showMessage(`${newRoomName} created successfully!`);
      setRoomForm({ grade: "1", section: "", assignedTeacherId: "" });
      fetchRooms();
      fetchUsers();
    } catch (error) {
      showMessage("Failed to create room.", "error");
    }
  };

  const handleEditRoom = (room) => {
    setEditingRoomId(room.id);
    setEditTeacherId(room.assignedTeacherId || "");
  };

  const handleSaveRoomEdit = async (room) => {
    try {
      const newTeacher = users.find((u) => u.id === editTeacherId);

      // Double-check strict 1-teacher-per-room rule
      if (newTeacher && editTeacherId !== room.assignedTeacherId && isTeacherAssigned(newTeacher)) {
        showMessage("This teacher is already assigned to another room.", "error");
        return;
      }

      const teacherName = newTeacher ? `${newTeacher.firstName} ${newTeacher.lastName}` : "Unassigned";
      const fullRoomName = `Grade ${room.grade} - ${room.name}`;

      await updateDoc(doc(db, "rooms", room.id), { assignedTeacherId: editTeacherId || "", assignedTeacherName: teacherName });

      if (room.assignedTeacherId && room.assignedTeacherId !== editTeacherId) {
        await updateDoc(doc(db, "users", room.assignedTeacherId), { assignedRoom: "" });
      }
      if (editTeacherId) {
        await updateDoc(doc(db, "users", editTeacherId), { assignedRoom: fullRoomName });
      }

      showMessage("Room updated successfully!");
      setEditingRoomId(null);
      fetchRooms();
      fetchUsers();
    } catch (error) {
      showMessage("Failed to update room.", "error");
    }
  };

  const handleDeleteRoom = async (roomId, name) => {
    if (window.confirm(`Are you sure you want to delete the room ${name}?`)) {
      try {
        const roomToDelete = rooms.find((r) => r.id === roomId);
        if (roomToDelete?.assignedTeacherId) {
          await updateDoc(doc(db, "users", roomToDelete.assignedTeacherId), { assignedRoom: "" });
        }

        await deleteDoc(doc(db, "rooms", roomId));
        showMessage("Room deleted successfully.");
        fetchRooms();
        fetchUsers();
      } catch (error) {
        showMessage("Failed to delete room.", "error");
      }
    }
  };

  let filteredUsers = users.filter((u) => u.role === roleFilter);

  if (roleFilter === "parent") {
    if (gradeFilter) filteredUsers = filteredUsers.filter((u) => u.assignedRoom?.includes(`Grade ${gradeFilter}`));
    if (sectionFilter) filteredUsers = filteredUsers.filter((u) => u.assignedRoom?.includes(sectionFilter));
  }

  filteredUsers.sort((a, b) => (a.lastName || a.fullName || "").localeCompare(b.lastName || b.fullName || ""));

  const totalItems = filteredUsers.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentDisplayedUsers = filteredUsers.slice(indexOfFirstItem, indexOfLastItem);
  const availableSections = gradeFilter ? rooms.filter((r) => r.grade.toString() === gradeFilter) : rooms;

  // Rooms available in Manage Users -> Edit dropdown
  const availableRoomsForEdit = editingUser
    ? editingUser.role === "teacher"
      ? rooms.filter((r) => !r.assignedTeacherId || r.assignedTeacherId === editingUser.id)
      : rooms
    : [];

  return (
    <SidebarLayout role="admin">
      <style>{`
        .admin-nav-bar { background: transparent; padding: 0 0 15px 0; display: flex; align-items: center; justify-content: flex-start; }
        .admin-burger { font-size: 1rem; background: #ffffff; border: 1px solid #d1d5db; padding: 8px 16px; border-radius: 8px; cursor: pointer; color: #111827; display: flex; align-items: center; gap: 8px; font-weight: 600; box-shadow: 0 1px 2px rgba(0,0,0,0.05); transition: background 0.2s; }
        .admin-burger:hover { background: #f3f4f6; }
        .admin-drawer { position: fixed; top: 0; left: 0; height: 100vh; width: 260px; background: white; z-index: 100; box-shadow: 4px 0 15px rgba(0,0,0,0.1); transform: translateX(-100%); transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1); display: flex; flex-direction: column; overflow-y: auto; }
        .admin-drawer.open { transform: translateX(0); }
        .admin-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 90; display: none; backdrop-filter: blur(2px); }
        .admin-overlay.open { display: block; }
        .drawer-header { padding: 1.5rem; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; }
        .drawer-link { padding: 1.25rem 1.5rem; cursor: pointer; border-bottom: 1px solid #f3f4f6; color: #374151; font-weight: 500; transition: all 0.2s; display: flex; justify-content: space-between; align-items: center; }
        .drawer-link:hover { background: #f9fafb; color: #1877f2; }
        .drawer-link.active { background: #eff6ff; color: #1877f2; border-left: 4px solid #1877f2; padding-left: calc(1.5rem - 4px); }
        .sub-menu { background-color: #f9fafb; display: flex; flex-direction: column; }
        .sub-drawer-link { padding: 1rem 1.5rem 1rem 2.5rem; cursor: pointer; border-bottom: 1px solid #e5e7eb; color: #4b5563; font-size: 0.9rem; transition: all 0.2s; }
        .sub-drawer-link.active { background: #eff6ff; color: #1877f2; font-weight: 600; border-left: 4px solid #1877f2; padding-left: calc(2.5rem - 4px); }
        .toast-popup { position: fixed; top: 20px; left: 50%; transform: translateX(-50%) translateY(-100px); opacity: 0; background: white; padding: 12px 24px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 9999; font-weight: 600; transition: all 0.4s cubic-bezier(0.18, 0.89, 0.32, 1.28); display: flex; align-items: center; gap: 10px; }
        .toast-popup.show { transform: translateX(-50%) translateY(0); opacity: 1; }
        .toast-success { border-left: 6px solid #10b981; color: #065f46; }
        .toast-error { border-left: 6px solid #ef4444; color: #991b1b; }
        .password-wrapper { position: relative; width: 100%; }
        .password-toggle-btn { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; padding: 4px; display: flex; align-items: center; justify-content: center; }
      `}</style>

      <div className={`toast-popup ${feedback.show ? "show" : ""} ${feedback.type === "error" ? "toast-error" : "toast-success"}`}>
        {feedback.text}
      </div>

      <div className="admin-nav-bar">
        <button className="admin-burger" onClick={() => setIsDrawerOpen(true)}>☰ Admin Menu</button>
      </div>

      <div className={`admin-overlay ${isDrawerOpen ? "open" : ""}`} onClick={() => setIsDrawerOpen(false)}></div>
      <div className={`admin-drawer ${isDrawerOpen ? "open" : ""}`}>
        <div className="drawer-header">
          <h2 style={{ fontSize: "1.2rem", margin: 0, color: "#1877f2" }}>Admin Portal</h2>
          <button style={{ background: "none", border: "none", fontSize: "1.75rem", cursor: "pointer", color: "#6b7280" }} onClick={() => setIsDrawerOpen(false)}>×</button>
        </div>

        <div className="drawer-link" onClick={() => setIsCreateMenuOpen(!isCreateMenuOpen)} style={{ fontWeight: "bold" }}>
          Create <span style={{ fontSize: "0.8rem", transform: isCreateMenuOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>▼</span>
        </div>

        {isCreateMenuOpen && (
          <div className="sub-menu">
            <div className={`sub-drawer-link ${activeView === "create-room" ? "active" : ""}`} onClick={() => { setActiveView("create-room"); setIsDrawerOpen(false); }}>Create Room</div>
            <div className={`sub-drawer-link ${activeView === "create-teacher" ? "active" : ""}`} onClick={() => { setActiveView("create-teacher"); setIsDrawerOpen(false); }}>Teacher Account</div>
            <div className={`sub-drawer-link ${activeView === "create-parent" ? "active" : ""}`} onClick={() => { setActiveView("create-parent"); setIsDrawerOpen(false); }}>Parent Account</div>
          </div>
        )}

        <div className={`drawer-link ${activeView === "manage" ? "active" : ""}`} onClick={() => { setActiveView("manage"); setIsDrawerOpen(false); setCurrentPage(1); }} style={{ fontWeight: "bold" }}>
          👥 Manage Users
        </div>
      </div>

      {/* =========================================
          VIEW: CREATE ROOM (STRICT 1 TEACHER PER ROOM)
      ========================================= */}
      {activeView === "create-room" && (
        <div className="card">
          <h3>Create New Room</h3>
          <p className="subtext">Create class sections and optionally assign an available teacher (1 adviser per room).</p>
          <form onSubmit={handleCreateRoom} style={{ display: "flex", flexDirection: "column", gap: "15px", maxWidth: "500px" }}>

            <label style={{ fontWeight: "600", fontSize: "0.875rem" }}>Grade Level</label>
            <select className="auth-input" name="grade" value={roomForm.grade} onChange={handleRoomChange} required>
              {[1, 2, 3, 4, 5, 6].map((g) => <option key={g} value={g}>Grade {g}</option>)}
            </select>

            <label style={{ fontWeight: "600", fontSize: "0.875rem" }}>Section Name</label>
            <input className="auth-input" type="text" name="section" placeholder="e.g. Apollo" value={roomForm.section} onChange={handleRoomChange} required />

            <label style={{ fontWeight: "600", fontSize: "0.875rem" }}>Assign Adviser (Unassigned Teachers Only)</label>
            <select className="auth-input" name="assignedTeacherId" value={roomForm.assignedTeacherId} onChange={handleRoomChange}>
              <option value="">-- Leave Unassigned --</option>
              {getUnassignedTeachers().map((t) => (
                <option key={t.id} value={t.id}>
                  {t.lastName}, {t.firstName} {t.middleInitial ? t.middleInitial + "." : ""}
                </option>
              ))}
            </select>

            <button className="btn-primary" type="submit" style={{ marginTop: "10px" }}>Create Room</button>
          </form>

          <hr style={{ margin: "2.5rem 0 1.5rem 0", border: "none", borderTop: "1px solid #e5e7eb" }} />

          <h3>Active Rooms</h3>
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Grade</th>
                  <th>Section</th>
                  <th>Assigned Adviser</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rooms.length === 0 ? (
                  <tr><td colSpan="4" className="empty-state">No rooms have been created yet.</td></tr>
                ) : (
                  rooms.map((room) => (
                    <tr key={room.id}>
                      <td style={{ fontWeight: "600" }}>Grade {room.grade}</td>
                      <td>{room.name}</td>
                      <td>
                        {editingRoomId === room.id ? (
                          <select className="auth-input" value={editTeacherId} onChange={(e) => setEditTeacherId(e.target.value)}>
                            <option value="">-- Unassigned --</option>
                            {getUnassignedTeachers(room.assignedTeacherId).map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.lastName}, {t.firstName}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span style={{ color: room.assignedTeacherName === "Unassigned" ? "#9ca3af" : "#1877f2", fontWeight: "500" }}>
                            {room.assignedTeacherName || "Unassigned"}
                          </span>
                        )}
                      </td>
                      <td>
                        {editingRoomId === room.id ? (
                          <div style={{ display: "flex", gap: "5px" }}>
                            <button className="btn-outline" style={{ color: "#10b981", borderColor: "#10b981", padding: "4px 8px", fontSize: "0.75rem" }} onClick={() => handleSaveRoomEdit(room)}>Save</button>
                            <button className="btn-outline" style={{ color: "#6b7280", borderColor: "#6b7280", padding: "4px 8px", fontSize: "0.75rem" }} onClick={() => setEditingRoomId(null)}>Cancel</button>
                          </div>
                        ) : (
                          <div style={{ display: "flex", gap: "5px" }}>
                            <button className="btn-outline" style={{ color: "#1877f2", borderColor: "#1877f2", padding: "4px 8px", fontSize: "0.75rem" }} onClick={() => handleEditRoom(room)}>Edit</button>
                            <button className="btn-outline" style={{ color: "#dc2626", borderColor: "#dc2626", padding: "4px 8px", fontSize: "0.75rem" }} onClick={() => handleDeleteRoom(room.id, room.name)}>Delete</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================
          VIEW: CREATE TEACHER
      ========================================= */}
      {activeView === "create-teacher" && (
        <div className="card">
          <h3>Create Teacher Account</h3>
          <form onSubmit={(e) => handleCreateUser(e, "teacher")} style={{ display: "flex", flexDirection: "column", gap: "15px", maxWidth: "500px" }}>
            <div style={{ display: "flex", gap: "10px" }}>
              <div style={{ flex: 2 }}>
                <label style={{ fontWeight: "600", fontSize: "0.875rem" }}>First Name</label>
                <input className="auth-input" type="text" name="firstName" value={formData.firstName} onChange={handleUserChange} required />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontWeight: "600", fontSize: "0.875rem" }}>M.I.</label>
                <input className="auth-input" type="text" name="middleInitial" placeholder="X" value={formData.middleInitial} onChange={handleUserChange} maxLength="1" />
              </div>
            </div>

            <label style={{ fontWeight: "600", fontSize: "0.875rem" }}>Last Name</label>
            <input className="auth-input" type="text" name="lastName" value={formData.lastName} onChange={handleUserChange} required />

            <label style={{ fontWeight: "600", fontSize: "0.875rem" }}>Email Address</label>
            <input className="auth-input" type="email" name="email" value={formData.email} onChange={handleUserChange} required />

            <label style={{ fontWeight: "600", fontSize: "0.875rem" }}>Assign Password</label>
            <div className="password-wrapper">
              <input
                className="auth-input"
                type={showCreatePassword ? "text" : "password"}
                name="password"
                placeholder="Password (min. 6 characters)"
                style={{ width: "100%", paddingRight: "42px", boxSizing: "border-box" }}
                value={formData.password}
                onChange={handleUserChange}
                minLength={6}
                required
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowCreatePassword((prev) => !prev)}
                aria-label={showCreatePassword ? "Hide password" : "Show password"}
              >
                {showCreatePassword ? <EyeOpenIcon /> : <EyeClosedIcon />}
              </button>
            </div>

            <button className="btn-primary" type="submit" style={{ marginTop: "10px" }}>Create Teacher Profile</button>
          </form>
        </div>
      )}

      {/* =========================================
          VIEW: CREATE PARENT
      ========================================= */}
      {activeView === "create-parent" && (
        <div className="card">
          <h3>Create Parent Account</h3>
          <form onSubmit={(e) => handleCreateUser(e, "parent")} style={{ display: "flex", flexDirection: "column", gap: "15px", maxWidth: "500px" }}>
            <label style={{ fontWeight: "600", fontSize: "0.875rem", color: "#1877f2", marginTop: "10px", borderBottom: "1px solid #e5e7eb", paddingBottom: "5px" }}>
              Parent Information
            </label>
            <div style={{ display: "flex", gap: "10px" }}>
              <div style={{ flex: 2 }}><input className="auth-input" type="text" name="firstName" placeholder="First Name" value={formData.firstName} onChange={handleUserChange} required /></div>
              <div style={{ flex: 1 }}><input className="auth-input" type="text" name="middleInitial" placeholder="M.I." value={formData.middleInitial} onChange={handleUserChange} maxLength="1" /></div>
            </div>
            <input className="auth-input" type="text" name="lastName" placeholder="Last Name" value={formData.lastName} onChange={handleUserChange} required />
            <input className="auth-input" type="email" name="email" placeholder="Email Address" value={formData.email} onChange={handleUserChange} required />

            <div className="password-wrapper">
              <input
                className="auth-input"
                type={showCreatePassword ? "text" : "password"}
                name="password"
                placeholder="Password (min. 6 characters)"
                style={{ width: "100%", paddingRight: "42px", boxSizing: "border-box" }}
                value={formData.password}
                onChange={handleUserChange}
                minLength={6}
                required
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowCreatePassword((prev) => !prev)}
                aria-label={showCreatePassword ? "Hide password" : "Show password"}
              >
                {showCreatePassword ? <EyeOpenIcon /> : <EyeClosedIcon />}
              </button>
            </div>

            <label style={{ fontWeight: "600", fontSize: "0.875rem", color: "#10b981", marginTop: "10px", borderBottom: "1px solid #e5e7eb", paddingBottom: "5px" }}>
              Student Information (Auto-Registers)
            </label>
            <div style={{ display: "flex", gap: "10px" }}>
              <input className="auth-input" style={{ flex: 1 }} type="text" name="studentFirstName" placeholder="Student First Name" value={formData.studentFirstName} onChange={handleUserChange} required />
              <input className="auth-input" style={{ flex: 1 }} type="text" name="studentLastName" placeholder="Student Last Name" value={formData.studentLastName} onChange={handleUserChange} required />
            </div>
            <input className="auth-input" type="text" inputMode="numeric" pattern="\d*" name="studentLRN" placeholder="12-digit LRN" maxLength="12" value={formData.studentLRN} onChange={handleUserChange} required />
            <select className="auth-input" name="assignedRoom" value={formData.assignedRoom} onChange={handleUserChange} required>
              <option value="">-- Assign Student to Room --</option>
              {rooms.map((r) => <option key={r.id} value={`Grade ${r.grade} - ${r.name}`}>Grade {r.grade} - {r.name}</option>)}
            </select>
            <button className="btn-primary" type="submit" style={{ marginTop: "15px" }}>Create Parent & Student Profile</button>
          </form>
        </div>
      )}

      {/* =========================================
          VIEW: MANAGE USERS (EDIT ROOM + CHANGE PASSWORD)
      ========================================= */}
      {activeView === "manage" && (
        <div className="card">
          <h3>Manage Users</h3>

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "1.5rem", padding: "1rem", backgroundColor: "#f9fafb", borderRadius: "8px" }}>
            <div style={{ flex: "1", minWidth: "150px" }}>
              <label style={{ fontSize: "0.8rem", fontWeight: "bold" }}>Role Filter</label>
              <select className="auth-input" value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setCurrentPage(1); setEditingUser(null); }}>
                <option value="teacher">Teachers</option>
                <option value="parent">Parents</option>
              </select>
            </div>

            {roleFilter === "parent" && (
              <>
                <div style={{ flex: "1", minWidth: "120px" }}>
                  <label style={{ fontSize: "0.8rem", fontWeight: "bold" }}>Grade</label>
                  <select className="auth-input" value={gradeFilter} onChange={(e) => { setGradeFilter(e.target.value); setSectionFilter(""); setCurrentPage(1); }}>
                    <option value="">All Grades</option>
                    {[1, 2, 3, 4, 5, 6].map((g) => <option key={g} value={g}>Grade {g}</option>)}
                  </select>
                </div>
                <div style={{ flex: "1", minWidth: "150px" }}>
                  <label style={{ fontSize: "0.8rem", fontWeight: "bold" }}>Section</label>
                  <select className="auth-input" value={sectionFilter} onChange={(e) => { setSectionFilter(e.target.value); setCurrentPage(1); }} disabled={!gradeFilter}>
                    <option value="">All Sections</option>
                    {availableSections.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
                  </select>
                </div>
              </>
            )}
          </div>

          {/* Edit User Panel (Edit Room + Change Password, No Unassign) */}
          {editingUser && (
            <div style={{ marginBottom: "20px", padding: "16px", backgroundColor: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: "8px" }}>
              <h4 style={{ fontWeight: "bold", margin: "0 0 12px 0", color: "#1e293b" }}>
                Edit {editingUser.role === "teacher" ? "Teacher" : "Parent"}: {editingUser.fullName}
              </h4>
              <form onSubmit={handleUpdateUser} style={{ display: "flex", flexDirection: "column", gap: "12px", maxWidth: "500px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "600", marginBottom: "4px" }}>
                    Assigned Room {editingUser.role === "teacher" ? "(Available Rooms Only)" : ""}
                  </label>
                  <select
                    className="auth-input"
                    value={newRoomAssignment}
                    onChange={(e) => setNewRoomAssignment(e.target.value)}
                    style={{ width: "100%" }}
                  >
                    {!newRoomAssignment && (
                      <option value="" disabled>-- Select a Room --</option>
                    )}
                    {availableRoomsForEdit.map((room) => (
                      <option key={room.id} value={`Grade ${room.grade} - ${room.name}`}>
                        Grade {room.grade} - {room.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "600", marginBottom: "4px" }}>
                    New Password (Optional — leave blank to keep current)
                  </label>
                  <div className="password-wrapper">
                    <input
                      className="auth-input"
                      type={showEditPassword ? "text" : "password"}
                      placeholder="Enter new password (min. 6 chars)"
                      style={{ width: "100%", paddingRight: "42px", boxSizing: "border-box" }}
                      value={newUserPassword}
                      onChange={(e) => setNewUserPassword(e.target.value)}
                      minLength={6}
                    />
                    <button
                      type="button"
                      className="password-toggle-btn"
                      onClick={() => setShowEditPassword((prev) => !prev)}
                      aria-label={showEditPassword ? "Hide password" : "Show password"}
                    >
                      {showEditPassword ? <EyeOpenIcon /> : <EyeClosedIcon />}
                    </button>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
                  <button
                    type="submit"
                    disabled={savingUserEdit}
                    style={{ padding: "8px 16px", backgroundColor: "#1877f2", color: "white", borderRadius: "6px", fontWeight: "bold", border: "none", cursor: "pointer" }}
                  >
                    {savingUserEdit ? "Saving..." : "Save Changes"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setEditingUser(null); setNewUserPassword(""); setShowEditPassword(false); }}
                    style={{ padding: "8px 16px", backgroundColor: "#94a3b8", color: "white", borderRadius: "6px", border: "none", cursor: "pointer" }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Name (A-Z)</th>
                  <th>Role</th>
                  <th>Email</th>
                  <th>Assigned Room</th>
                  {roleFilter === "parent" && <th>Student LRN</th>}
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentDisplayedUsers.length === 0 ? (
                  <tr><td colSpan="6" className="empty-state">No users match the current filters.</td></tr>
                ) : (
                  currentDisplayedUsers.map((user) => (
                    <tr key={user.id}>
                      <td style={{ fontWeight: "600" }}>{user.lastName}, {user.firstName} {user.middleInitial ? user.middleInitial + "." : ""}</td>
                      <td>
                        <span className="badge" style={{ backgroundColor: user.role === "teacher" ? "#dbeafe" : "#fef3c7", color: user.role === "teacher" ? "#1e3a8a" : "#92400e" }}>
                          {user.role.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ color: "#4b5563", fontSize: "0.875rem" }}>{user.email}</td>
                      <td style={{ color: "#6b7280", fontSize: "0.875rem" }}>{user.assignedRoom || "Unassigned"}</td>
                      {roleFilter === "parent" && <td style={{ color: "#6b7280", fontSize: "0.875rem" }}>{user.studentLRN || "N/A"}</td>}
                      <td style={{ display: "flex", gap: "5px" }}>
                        <button
                          className="btn-outline"
                          style={{ color: "#1877f2", borderColor: "#1877f2", padding: "6px 12px", fontSize: "0.75rem" }}
                          onClick={() => {
                            setEditingUser(user);
                            setNewRoomAssignment(user.assignedRoom || "");
                            setNewUserPassword("");
                            setShowEditPassword(false);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="btn-outline"
                          style={{ color: "#dc2626", borderColor: "#dc2626", padding: "6px 12px", fontSize: "0.75rem" }}
                          onClick={() => handleDeleteUser(user.id, user.fullName)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalItems > 0 && (
            <div className="pagination-controls" style={{ marginTop: "1.5rem" }}>
              <button className="btn-outline" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>Previous</button>
              <span style={{ fontSize: "0.875rem", fontWeight: "bold", color: "#374151" }}>{Math.min(indexOfLastItem, totalItems)} / {totalItems}</span>
              <button className="btn-outline" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</button>
            </div>
          )}
        </div>
      )}
    </SidebarLayout>
  );
}