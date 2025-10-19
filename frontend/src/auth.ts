
const backendUrl = import.meta.env.VITE_BACKEND_URL;

export const getUserId = async(): Promise<string> => {
    const res = await fetch(`${backendUrl}auth/me`, {
        method: "GET",
        credentials: "include",
    });

    if (!res.ok) {
        throw new Error("Unauthorized");
    }
    const data = await res.json();
    return data.userId;
}