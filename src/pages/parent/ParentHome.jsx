import { useState, useEffect } from "react";
import SidebarLayout from "../../components/SidebarLayout";
import { getStudentsBySection } from "../../firebase/attendanceService";
import { db } from "../../firebase/firebase";
import { collection, getDocs } from "firebase/firestore";

export default function ParentHome() {
  const [availableRooms, setAvailableRooms] = useState([]);
  const [joinedChild, setJoinedChild] = useState(null);
  const [searchName, setSearchName] = useState("");
  const [selectedRoomToJoin, setSelectedRoomToJoin] = useState(null);

  // Modern UI Feedback Banner
  const [feedback, setFeedback] = useState({ text: "", type: "" });

  const showMessage = (text, type = "success") => {
    setFeedback({ text, type });
    setTimeout(() => setFeedback({ text: "", type: "" }), 3000);
  };

  useEffect(() => {
    const savedChild = localStorage.getItem("joinedChild");
    if (savedChild) setJoinedChild(JSON.parse(savedChild));

    const fetchRooms = async () => {
      const querySnapshot = await getDocs(collection(db, "rooms"));
      const loadedRooms = [];
      querySnapshot.forEach((doc) => loadedRooms.push({ id: doc.id, ...doc.data() }));
      loadedRooms.sort((a, b) => a.grade - b.grade);
      setAvailableRooms(loadedRooms);
    };
    fetchRooms();
  }, []);

  const attemptJoin = async (e) => {
    e.preventDefault();
    const response = await getStudentsBySection(selectedRoomToJoin.name);
    
    if (response.success) {
      const foundChild = response.students.find(s => s.fullName.toLowerCase() === searchName.toLowerCase().trim());
      
      if (foundChild) {
        setJoinedChild(foundChild);
        localStorage.setItem("joinedChild", JSON.stringify(foundChild));
        setSelectedRoomToJoin(null);
        showMessage("Child verified! You are now connected.");
      } else {
        showMessage("Child not found in this room. Please check the spelling.", "error");
      }
    } else {
      showMessage("Error connecting to room.", "error");
    }
  };

  const handleDisconnect = () => {
    localStorage.removeItem("joinedChild");
    setJoinedChild(null);
    showMessage("Disconnected from room.", "success");
  };

  return (
    <SidebarLayout role="parent">
      
      {/* Feedback Banner */}
      {feedback.text && (
        <div style={{
          padding: '12px 16px', marginBottom: '1rem', borderRadius: '8px', fontWeight: '500',
          backgroundColor: feedback.type === 'error' ? '#fee2e2' : '#d1fae5',
          color: feedback.type === 'error' ? '#991b1b' : '#065f46',
          border: `1px solid ${feedback.type === 'error' ? '#f87171' : '#34d399'}`
        }}>
          {feedback.text}
        </div>
      )}

      {!joinedChild ? (
        <div className="card">
          <h3>Available Rooms</h3>
          <p style={{ color: "#6b7280", marginBottom: "1rem" }}>Select your child's room to connect.</p>
          
          {availableRooms.length === 0 ? <p>No rooms have been created by teachers yet.</p> : (
            <div className="flex-row">
              {availableRooms.map((room) => (
                <button key={room.id} className="btn-secondary" onClick={() => setSelectedRoomToJoin(room)}>
                  Grade {room.grade} - {room.name}
                </button>
              ))}
            </div>
          )}

          {selectedRoomToJoin && (
            <div style={{ marginTop: "2rem", padding: "1rem", border: "1px solid #d1d5db", borderRadius: "8px" }}>
              <h4>Join {selectedRoomToJoin.name}</h4>
              <form onSubmit={attemptJoin} style={{ display: "flex", gap: "10px", marginTop: "10px", flexWrap: "wrap" }}>
                <input 
                  className="auth-input" 
                  style={{ flex: 1, minWidth: "200px" }}
                  placeholder="Enter Child's Full Name" 
                  value={searchName} 
                  onChange={(e) => setSearchName(e.target.value)} 
                  required 
                />
                <button type="submit" className="btn-primary">Verify & Join</button>
              </form>
            </div>
          )}
        </div>
      ) : (
        <div className="card">
          <h3>Successfully Connected</h3>
          <p style={{ fontSize: "1.2rem", fontWeight: "bold", margin: "10px 0" }}>{joinedChild.fullName}</p>
          <p>Grade {joinedChild.gradeLevel} - {joinedChild.section}</p>
          
          <button className="btn-secondary" style={{ marginTop: "1rem" }} onClick={handleDisconnect}>
            Disconnect / Switch Room
          </button>
        </div>
      )}
    </SidebarLayout>
  );
}