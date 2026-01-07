import { useState, useEffect } from 'react'
import './index.css'

function App() {
  const [routerIps, setRouterIps] = useState('')
  const [commands, setCommands] = useState('')
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('cisco')
  const [status, setStatus] = useState('')
  const [taskId, setTaskId] = useState(null)
  const [taskResult, setTaskResult] = useState(null)
  const [taskList, setTaskList] = useState([])

  const presetCommands = {
    "show_ver": "show version",
    "ospf_config": "router ospf 1\nnetwork 0.0.0.0 255.255.255.255 area 0",
    "int_shut": "interface GigabitEthernet1\nshutdown"
  }

  // Fetch task list on mount
  useEffect(() => {
    fetchTasks()
  }, [])

  const fetchTasks = async () => {
    try {
      const res = await fetch('/api/tasks')
      if (res.ok) {
        const data = await res.json()
        setTaskList(data)
      }
    } catch (e) {
      console.error("Failed to fetch tasks", e)
    }
  }

  const handlePresetChange = (e) => {
    const val = e.target.value;
    if (val && presetCommands[val]) {
      setCommands(presetCommands[val]);
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setStatus('Submitting...')
    setTaskResult(null)

    // Parse IPs from comma separated string
    const ips = routerIps.split(',').map(ip => ip.trim()).filter(ip => ip)

    // Parse commands from lines
    const cmdList = commands.split('\n').filter(cmd => cmd.trim())

    const payload = {
      router_ips: ips,
      commands: cmdList,
      username,
      password,
      device_type: "cisco_ios"
    }

    try {
      // In production, use env var or proper proxy
      const response = await fetch('/api/configure', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const data = await response.json()
      if (response.ok) {
        setStatus(`Task submitted! ID: ${data.task_id}`)
        setTaskId(data.task_id)
        pollStatus(data.task_id)
        // Refresh task list shortly after submission to show pending task
        setTimeout(fetchTasks, 1000)
      } else {
        setStatus('Error submitting task')
      }
    } catch (err) {
      console.error(err)
      setStatus('Network error')
    }
  }

  const pollStatus = async (id) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/tasks/${id}`)
        const data = await res.json()

        // If the currently viewed task is the one being polled, update the view
        if (taskId === id) {
          setTaskResult(data)
        }

        if (data.task_status === 'SUCCESS' || data.task_status === 'FAILURE') {
          clearInterval(interval)
          // Refresh list to show final status
          fetchTasks()
          if (taskId === id) {
            setStatus(`Task finished: ${data.task_status}`)
          }
        }
      } catch (e) {
        // ignore
      }
    }, 2000)
  }

  const loadTask = async (id) => {
    try {
      setTaskId(id)
      const res = await fetch(`/api/tasks/${id}`)
      const data = await res.json()
      setTaskResult(data)
      setStatus(`Loaded task: ${data.task_status}`)
    } catch (e) {
      console.error(e)
    }
  }

  const downloadJson = () => {
    if (!taskResult) return
    const jsonString = JSON.stringify(taskResult.task_result, null, 2)
    const blob = new Blob([jsonString], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `task_${taskResult.task_id}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="container" style={{ display: 'flex', maxWidth: '1200px', gap: '20px' }}>

      {/* Left Column: Main Form */}
      <div style={{ flex: 2 }}>
        <h1>Router Automation Dashboard</h1>

        <div className="card">
          <h2>Target Routers</h2>
          <input
            type="text"
            placeholder="192.168.1.1, 192.168.1.2"
            value={routerIps}
            onChange={(e) => setRouterIps(e.target.value)}
            style={{ width: '100%', padding: '10px' }}
          />
        </div>

        <div className="card">
          <h2>Credentials</h2>
          <input type="text" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} />
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
        </div>

        <div className="card">
          <h2>Configuration</h2>
          <select onChange={handlePresetChange} style={{ marginBottom: '10px' }}>
            <option value="">-- Select Preset --</option>
            <option value="show_ver">Show Version</option>
            <option value="ospf_config">Configure OSPF</option>
            <option value="int_shut">Shutdown Interface Gi1</option>
          </select>
          <textarea
            rows={10}
            placeholder="Enter commands here..."
            value={commands}
            onChange={(e) => setCommands(e.target.value)}
            style={{ width: '100%', fontFamily: 'monospace' }}
          />
        </div>

        <button onClick={handleSubmit} style={{ marginTop: '20px', padding: '10px 20px', fontSize: '16px' }}>
          Apply Configuration
        </button>

        {status && <div className="status-bar">{status}</div>}

        {taskResult && (
          <div className="result-area">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>Results (ID: {taskResult.task_id.substring(0, 8)}...)</h3>
              <button onClick={downloadJson} style={{ background: '#28a745', color: '#fff' }}>Download JSON</button>
            </div>
            <pre>{JSON.stringify(taskResult.task_result, null, 2)}</pre>
          </div>
        )}
      </div>

      {/* Right Column: History Sidebar */}
      <div style={{ flex: 1, borderLeft: '1px solid #ddd', paddingLeft: '20px' }}>
        <h2>Recent Tasks</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {taskList.map(t => (
            <div
              key={t.task_id}
              className="card"
              style={{ padding: '10px', cursor: 'pointer', background: taskId === t.task_id ? '#eef' : '#fff' }}
              onClick={() => loadTask(t.task_id)}
            >
              <div style={{ fontWeight: 'bold' }}>{t.task_status}</div>
              <div style={{ fontSize: '0.8em', color: '#666' }}>{new Date(t.created_at).toLocaleString()}</div>
              <div style={{ fontSize: '0.7em', fontFamily: 'monospace' }}>{t.task_id.substring(0, 8)}</div>
            </div>
          ))}
          {taskList.length === 0 && <p>No tasks yet.</p>}
        </div>
      </div>

    </div>
  )
}

export default App
