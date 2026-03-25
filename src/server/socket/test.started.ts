import { subscribe } from "./eventbus";

export const onTestStarted = () => {
    return subscribe((event) => {
        if (event.type === "test_started") {
            console.log("Test started event received in onTestStarted:", event.data);
        }
    });
}