import R2Error from '../../model/errors/R2Error';
import Profile from '../../model/Profile';
import FileWriteError from '../../model/errors/FileWriteError';

import * as path from 'path';
import FsProvider from '../../providers/generic/file/FsProvider';
import ManagerSettings from './ManagerSettings';
import LoggerProvider, { LogSeverity } from '../../providers/ror2/logging/LoggerProvider';
import GameDirectoryResolver from './GameDirectoryResolver';
import FileUtils from '../../utils/FileUtils';

export default class ModLinker {

    public static link(): string[] | R2Error {
        const settings = ManagerSettings.getSingleton();
        const riskOfRain2Directory: string | R2Error = GameDirectoryResolver.getDirectory();
        if (riskOfRain2Directory instanceof R2Error) {
            return riskOfRain2Directory;
        }
        return this.performLink(riskOfRain2Directory, settings.linkedFiles);
    }

    private static performLink(installDirectory: string, previouslyLinkedFiles: string[]): string[] | R2Error {
        const fs = FsProvider.instance;
        const newLinkedFiles: string[] = [];
        try {
            LoggerProvider.instance.Log(LogSeverity.INFO, `Files to remove: \n-> ${previouslyLinkedFiles.join('\n-> ')}`);
            previouslyLinkedFiles.forEach((file: string) => {
                LoggerProvider.instance.Log(LogSeverity.INFO, `Removing previously copied file: ${file}`);
                if (fs.existsSync(file)) {
                    if (fs.lstatSync(file).isDirectory()) {
                        FileUtils.emptyDirectory(file);
                        fs.rmdirSync(file);
                    } else {
                        fs.unlinkSync(file);
                    }
                }
            });
            try {
                const profileFiles = fs.readdirSync(Profile.getActiveProfile().getPathOfProfile());
                try {
                    profileFiles.forEach((file: string) => {
                        if (fs.lstatSync(path.join(Profile.getActiveProfile().getPathOfProfile(), file)).isFile()) {
                            if (file.toLowerCase() !== 'mods.yml') {
                                try {
                                    if (fs.existsSync(path.join(installDirectory, file))) {
                                        fs.unlinkSync(path.join(installDirectory, file));
                                    }
                                    // Existing -> Linked
                                    // Junction is used so users don't need Windows Developer Mode enabled.
                                    // https://stackoverflow.com/questions/57725093
                                    fs.copyFileSync(path.join(Profile.getActiveProfile().getPathOfProfile(), file), path.join(installDirectory, file));
                                    newLinkedFiles.push(path.join(installDirectory, file));
                                } catch(e) {
                                    const err: Error = e;
                                    throw new FileWriteError(
                                        `Couldn't copy file ${file} to RoR2 directory`,
                                        err.message,
                                        'Try running r2modman as an administrator'
                                    )
                                }
                            }
                        }
                    })
                } catch(e) {
                    const err: Error = e;
                    return new FileWriteError(
                        'Failed to install required files',
                        err.message,
                        'The game must not be running. You may need to run r2modman as an administrator.'
                    );
                }
            } catch(e) {
                const err: Error = e;
                return new R2Error(
                    `Unable to read directory for profile ${Profile.getActiveProfile().getProfileName()}`,
                    err.message,
                    'Try running r2modman as an administrator'
                )
            }
        } catch(e) {
            const err: Error = e;
            return new R2Error(
                'Unable to delete file',
                err.message,
                'Try running r2modman as an administrator'
            )
        }
        return newLinkedFiles;
    }

}
