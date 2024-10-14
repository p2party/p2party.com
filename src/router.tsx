import { lazy } from "react";
import { createBrowserRouter } from "react-router-dom";
import { Provider } from "react-redux";
import p2party from "p2party";

const Layout = lazy(() => import("./pages/layout"));
const HomePage = lazy(() => import("./pages/home"));
const ChatPage = lazy(() => import("./pages/chat"));

export const router = createBrowserRouter([
  {
    path: "/room/:roomUrl",
    element: (
      <Provider store={p2party.store}>
        <Layout>
          <ChatPage />
        </Layout>
      </Provider>
    ),
  },
  {
    path: "/",
    element: <HomePage />,
  },
]);
//   createRoutesFromElements(
//     <Routei element={<Layout />}>
//       <Route
//         path='/room/:roomUrl'
//         element={
//           <Provider store={p2party.store}>
//             <Layout>
//               <ChatPage />
//             </Layout>
//           </Provider>
//         }
//       />
//       <Route path='*' element={<HomePage />} />
//     </Route>,
//   ),
// );
