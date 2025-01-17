/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';

import fs = require('fs')
import { commands, workspace, ExtensionContext, events } from 'coc.nvim';
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind, StreamInfo, Uri } from 'coc.nvim';
import { fileURLToPath, sleep } from './utils'
import {getPlatformDetails, OperatingSystem, omnisharpExe, downloadOmnisharp, currentPlatform, omnisharpRunScript} from './platform';

const logger = workspace.createOutputChannel("coc-omnisharp")

async function getCurrentSelection(mode: string) {
    let doc = await workspace.document

    if (mode === "v" || mode === "V") {
        let [from, _ ] = await doc.buffer.mark("<")
        let [to, __  ] = await doc.buffer.mark(">")
        let result: string[] = []
        for(let i = from; i <= to; ++i)
        {
            result.push(doc.getline(i - 1))
        }
        return result
    }
    else if (mode === "n") {
        let line = await workspace.nvim.call('line', '.')
        return [doc.getline(line - 1)]
    }
    else if (mode === "i") {
        // TODO what to do in insert mode?
    }
    else if (mode === "t") {
        //TODO what to do in terminal mode?
    }

    return []
}

export async function activate(context: ExtensionContext) {

    logger.appendLine("coc-omnisharp activated.")
    logger.appendLine(`workspace root=${workspace.rootPath}`)

    // Options to control the language client
    let clientOptions: LanguageClientOptions = {
        // Register the server for C#/VB documents
        documentSelector: [{ scheme: 'file', language: 'cs' }, { scheme: 'file', language: 'vb'}],
        synchronize: {
            configurationSection: 'omnisharp',
            fileEvents: [
                workspace.createFileSystemWatcher('**/*.cs'),
                workspace.createFileSystemWatcher('**/*.csx'),
                workspace.createFileSystemWatcher('**/*.cake'),
                workspace.createFileSystemWatcher('**/*.vb')
            ]
        }
    }

    if (!fs.existsSync(omnisharpExe)) {
        let item = workspace.createStatusBarItem(0, {progress: true})
        item.text = "Downloading OmniSharp"
        item.show()
        await downloadOmnisharp()
        item.dispose()
    }

    let directRun = omnisharpExe
    if (currentPlatform.operatingSystem !== OperatingSystem.Windows) {
        fs.chmodSync(omnisharpRunScript, '755')
        directRun = omnisharpRunScript
    }

    const config = workspace.getConfiguration('omnisharp')
    const useDotnet = config.get<boolean>('useDotnet', false)

    let serverOptions = 
        useDotnet 
        ?  {
            command: "dotnet",
            args: [omnisharpExe, "-lsp"],
            options: { cwd: workspace.rootPath } 
        }
        :  {
            command: directRun,
            args: ["-lsp"],
            options: { cwd: workspace.rootPath } 
        }


    // Create the language client and start the client.
    let client = new LanguageClient('cs', 'OmniSharp Language Server', serverOptions, clientOptions);
    let disposable = client.start();
    // Push the disposable to the context's subscriptions so that the 
    // client can be deactivated on extension deactivation
    context.subscriptions.push(disposable);
}
