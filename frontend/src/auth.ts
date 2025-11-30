
const backendUrl = import.meta.env.VITE_BACKEND_URL;

export const getUserId = async(): Promise<string> => {
    const res = await fetch(`${backendUrl}auth/me`, {
        method: "GET",
        credentials: "include",
    });

    if (!res.ok) {
        window.location.href = `./login`;
    }
    const data = await res.json();
    return data.userId;
}

export const getUserInfo = async(): Promise<
    {
        userId: string; 
        email?: string; 
        apiKey?: {
            deepgram?: string; 
            deepl?: string
        }
    }
> => {
    const res = await fetch(`${backendUrl}auth/userInfo`, {
        method: "GET",
        credentials: "include",
    });

    if (!res.ok) {
        window.location.href = `./login`;
    }
    const data = await res.json();
    return {
        userId: data.userId,
        email: data.email,
        apiKey: {
            deepgram: data.apiKey.deepgram,
            deepl: data.apiKey.deepl
        }
    };
}
