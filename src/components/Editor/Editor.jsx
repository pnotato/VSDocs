import { Editor } from "@monaco-editor/react";
import { useState, useRef } from "react";
import { CODE_SNIPPETS, FILE_EXTENSIONS } from "../../constants.js";
import { executeCode } from "../api.js";

// Stylizing
import './Editor.css'
import Button from "../Button/Button.jsx";
import Selector from "./Selector.jsx";
import EditorSettingsModal from "../Modal/EditorSettings.jsx";
import ShareModal from "../Modal/Share.jsx";
import SignInModal from '../Modal/SignIn.jsx'
import { LuSettings, LuDownload } from "react-icons/lu";

// Socketing
import { io } from "socket.io-client";

const socket = io("ws://localhost:3000")

const CodeEditor = ({ roomCode }) => {
    const editorRef = useRef();
    const [value, setValue] = useState('');
    const [language, setLanguage] = useState('javascript');
    const [isLoading, setIsLoading] = useState(false);
    const [output, setOutput] = useState(null);
    const [error, setError] = useState(false);
    const [EditorSettings, EditorSettingsOpen] = useState(false);
    const [ShareMenu, ShareMenuOpen] = useState(false);
    const [SignInMenu, SignInMenuOpen] = useState(false);
    const [fontSize, setFontSize] = useState(14);

    const onMount = (editor) => {
        editorRef.current = editor;
        editor.focus();
    }

    const onSelect = (language) => {
        setLanguage(language);
        setValue(
            CODE_SNIPPETS[language]
        )
    }

    const onEditorUpdate = (value) => {
        // console.log(value);
        socket.emit('editor-update', value)
    }
    socket.on('editor-update-return', value => {
        setValue(value);
    });

    const runCode = async () => {
        const sourceCode = editorRef.current.getValue();
        if (!sourceCode) return;
        setOutput("Loading...")
        setError(false)
        try {
            setIsLoading(true)
            const { run: result } = await executeCode(language, sourceCode);
            setOutput(result.output)
            console.log(result)
            if (result.stderr) {
                setError(true);
            }
            if (result.signal == "SIGKILL") {
                throw "SIGKILL"
                // Generally this occurs if your code takes too long, i.e long for loops
                // In which the piston API just kills the process.
            }
        } catch (error) {
            console.log(error)
            setError(true);
            setOutput("Timed out.")
        } finally {

            setIsLoading(false); // used for loading spinner
        }
    }

    const downloadScript = (content, fileType) => {
        const filename = fileType || "file.txt";
        const mimeTypes = {
            js: "text/javascript",
            ts: "application/typescript",
            py: "text/x-python",
            java: "text/x-java-source",
            cs: "text/plain",
            php: "application/x-httpd-php",
        };
        const extension = filename.split(".").pop();
        const mimeType = mimeTypes[extension] || "text/plain";

        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();

        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    return (
        <div className='interface'>
            <div className='code-editor'>
                <div className='code-editor-options'>
                    <div className='selector-options'>
                        <Selector language={language} onSelect={onSelect} />
                        <Button Icon={<LuSettings />} onClick={() => EditorSettingsOpen(true)} />
                        <Button Icon={<LuDownload />} onClick={() => downloadScript(value, FILE_EXTENSIONS[language])} />
                    </div>


                    <Button Label="Run Code" onClick={runCode} />
                </div>
                <EditorSettingsModal open={EditorSettings} setOpen={EditorSettingsOpen} 
                    fontSize={fontSize} setFontSize={setFontSize}/>
                <ShareModal open={ShareMenu} setOpen={ShareMenuOpen}/>
                <SignInModal open={SignInMenu} setOpen={SignInMenuOpen} />
                <Editor
                    theme="vs-dark"
                    language={language}
                    defaultValue="// Code goes here!"
                    onMount={onMount}
                    value={value}
                    onChange={(value) => {
                        // setValue(value);
                        onEditorUpdate(value);
                    }}
                    options={{
                        fontSize: fontSize
                    }}
                />
            </div>
            <div className={'code-output'}>
                <div className="code-chat">
                    <div className={'code-chat-options'}>
                        <Button Label="Share" onClick={() => ShareMenuOpen(true)}/>
                        <Button Label="Sign In" onClick={() => SignInMenuOpen(true)} />
                    </div>
                </div>
                <div className={'code-output-box'}>
                    <a style={{ color: error ? 'red' : output ? 'white' : 'grey' }}
                        className={'code-output-text'}>
                        {error ? 'Error: ' + output : output ? output : 'Click "Run Code" to see the output here.'}</a>
                </div>
            </div>

        </div>
    )
}

export default CodeEditor