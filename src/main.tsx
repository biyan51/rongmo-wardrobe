import React from "react";
import {createRoot} from "react-dom/client";
import Wardrobe from "./wardrobe";
createRoot(document.getElementById("root")!).render(<Wardrobe canManage={false}/>);
