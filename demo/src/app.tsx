import "elt/ui"
import { node_append } from "elt";
import { app } from "./routes"

node_append(document.body, app.DisplayView("Main"))