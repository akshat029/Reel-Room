import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
import { useThemeStore } from './stores/themeStore';
import { Layout } from './components/Layout';
import { JoinLanding } from './pages/JoinLanding';
import { CreateRoom } from './pages/CreateRoom';
import { RoomPage } from './pages/RoomPage';
import { JoinRoom } from './pages/JoinRoom';

function App() {
    const { isDark } = useThemeStore();

    useEffect(() => {
        // Apply dark mode class to document
        if (isDark) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [isDark]);

    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Layout />}>
                    <Route index element={<JoinLanding />} />
                    <Route path="create" element={<CreateRoom />} />
                    <Route path="join/:code" element={<JoinRoom />} />
                    <Route path="room/:code" element={<RoomPage />} />
                </Route>
            </Routes>
        </BrowserRouter>
    );
}

export default App;
