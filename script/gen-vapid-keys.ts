/**
 * Generate a VAPID key pair for Web Push and print the env vars to set.
 *
 *   npm run gen:vapid-keys
 *
 * Prints to the terminal only. It deliberately does not write .env or any
 * other file: a private key that lands in the working tree is one `git add .`
 * away from the repository.
 */
import webpush from "web-push";
import { vapidKeyInstructions } from "../server/vapidConfig";

console.log(vapidKeyInstructions(webpush.generateVAPIDKeys()));
